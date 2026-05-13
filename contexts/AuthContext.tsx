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
        startRealtimeSync(u.uid);
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
  // 1. Ensure system data exists locally FIRST
  await ensureSystemData(userId);

  // 2. Populate Zustand from Dexie — UI renders instantly from here
  await useStore.getState().init(userId);

  // 3. Run all network sync in the background
  (async () => {
    // Push pending local writes first
    try {
      await processSyncQueue();
    } catch {
      // Non-fatal — offline scenario
    }

    // Incremental delta sync (or full hydration if first login on this device)
    try {
      await incrementalSync(userId);
    } catch {
      // Non-fatal — local data still valid
    }

    // Purge old bin items
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
