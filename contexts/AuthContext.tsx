'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureSystemData } from '@/lib/bootstrap';
import { getDb } from '@/lib/db';

import {
  incrementalSync,
  setupSyncListener,
  clearLocalData,
  startRealtimeSync,
  stopRealtimeSync,
  processSyncQueue,
  purgeExpiredBinItems,
} from '@/lib/sync';
import { useStore } from '@/store/useStore';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. FAST-PATH: If we have a cached UID and are offline (or just to be fast), 
    // we can try to "peek" at the local data immediately.
    const cachedUid = localStorage.getItem('money_ledger_last_uid');
    let fastPathTriggered = false;

    if (cachedUid) {
      fastPathTriggered = true;
      prepareLocalData(cachedUid).catch(() => undefined);
      // We don't setLoading(false) yet, we wait for official Firebase or timeout
    }

    // 2. TIMEOUT SAFETY: If auth takes too long, stop the loader.
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2500); // 2.5s is a generous buffer for slow network

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeoutId);

      if (u) {
        // Official user found
        localStorage.setItem('money_ledger_last_uid', u.uid);
        await prepareLocalData(u.uid);
        // NOTE: startRealtimeSync is now called inside prepareLocalData's
        // background block AFTER incrementalSync completes, to avoid the
        // initial onSnapshot firing simultaneously with the sync query.
      } else {
        // No official user
        stopRealtimeSync();
        useStore.getState().reset();
        // If we were using a fast-path UID but it turns out we are logged out,
        // we should stop pretending we are logged in.
        if (fastPathTriggered) {
          localStorage.removeItem('money_ledger_last_uid');
        }
      }

      setUser((prev) => {
        if (prev?.uid === u?.uid) return prev;
        return u;
      });
      setLoading(false);
    });

    const cleanupSync = setupSyncListener();
    return () => {
      clearTimeout(timeoutId);
      unsub();
      cleanupSync();
      stopRealtimeSync();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged fires → prepareLocalData → ensureSystemData handles everything
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const r = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(r.user, { displayName: name });
      // onAuthStateChanged fires → prepareLocalData → ensureSystemData handles everything
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged fires → prepareLocalData → ensureSystemData handles everything
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign in failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password reset failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    stopRealtimeSync();
    // Flush any pending offline writes before wiping local data
    if (navigator.onLine) {
      await processSyncQueue().catch(() => undefined);
    }
    await firebaseSignOut(auth);
    await clearLocalData();
    useStore.getState().reset();
  }, []);

  const stableUser = useMemo(() => user, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ user: stableUser, loading, error, signIn, signUp, signInWithGoogle, resetPassword, signOut, clearError }),
    [stableUser, loading, error, signIn, signUp, signInWithGoogle, resetPassword, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * Startup sequence:
 * 1. Flush any locally-queued writes to Firestore
 * 2. Incremental sync  →  new device = full hydration once
 *                         existing device = only changed docs since lastSyncTime
 * 3. Ensure system tabs / month-window exist locally
 * 4. Load Dexie into Zustand (renders UI immediately)
 * 5. Purge recycle-bin items older than 30 days (fire-and-forget)
 */
async function prepareLocalData(userId: string): Promise<void> {
  const db = await import('@/lib/db').then((m) => m.getDb());
  const hasLocalData = (await db.tabs.where('userId').equals(userId).count()) > 0;

  if (hasLocalData) {
    // Returning device — show local data instantly from Dexie
    await useStore.getState().init(userId);
  }
  // New device: don't show anything yet — wait for sync below

  // All network work runs in background — never blocks the UI
  (async () => {
    // Step 1: push any pending local writes first
    try {
      await processSyncQueue();
    } catch {
      // offline — fine
    }

    // Step 2: sync from Firestore
    // New device  → fullHydrateFromFirestore (all docs)
    // Old device  → delta sync (only changed docs since lastSyncTime)
    try {
      await incrementalSync(userId);
    } catch {
      // offline — local data still valid
    }

    // Step 3: AFTER sync, create system defaults if needed
    // Doing this after sync means we never duplicate tabs that already exist in Firestore
    await ensureSystemData(userId);

    // Step 4: refresh Zustand with the fully synced Dexie state
    await useStore.getState().init(userId);

    // Step 4b: start realtime listeners AFTER initial sync
    // This prevents the initial onSnapshot from doing duplicate work
    startRealtimeSync(userId);

    // Step 5: cleanup
    purgeExpiredBinItems(userId).catch(() => undefined);
  })();
}

function friendlyError(msg: string): string {
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
    return 'Incorrect email or password.';
  if (msg.includes('email-already-in-use')) return 'This email is already registered.';
  if (msg.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (msg.includes('invalid-email')) return 'Please enter a valid email address.';
  if (msg.includes('network')) return 'Network error. Check your connection.';
  if (msg.includes('popup-closed')) return 'Sign in was cancelled.';
  return msg;
}
