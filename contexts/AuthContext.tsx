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
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureSystemData } from '@/lib/bootstrap';
import { initializeUserData } from '@/lib/firestore';
import {
  hydrateFromFirestore,
  setupSyncListener,
  clearLocalData,
  startRealtimeSync,
  stopRealtimeSync,
  processSyncQueue,
} from '@/lib/sync';
import { useStore } from '@/store/useStore';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser((prev) => {
        if (prev?.uid === u?.uid) return prev;
        return u;
      });

      if (u) {
        await prepareLocalData(u.uid);
        // Start real-time listeners so changes from other devices appear live
        startRealtimeSync(u.uid);
      } else {
        stopRealtimeSync();
        useStore.getState().reset();
      }

      setLoading(false);
    });

    const cleanupSync = setupSyncListener();
    return () => {
      unsub();
      cleanupSync();
      stopRealtimeSync();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const r = await signInWithEmailAndPassword(auth, email, password);
      await initializeUserData(r.user.uid);
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
      await initializeUserData(r.user.uid);
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
      const r = await signInWithPopup(auth, provider);
      await initializeUserData(r.user.uid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign in failed.';
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
    () => ({ user: stableUser, loading, error, signIn, signUp, signInWithGoogle, signOut, clearError }),
    [stableUser, loading, error, signIn, signUp, signInWithGoogle, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

async function prepareLocalData(userId: string): Promise<void> {
  try {
    // 1) Flush any pending local writes first (phone may have queued changes)
    await processSyncQueue();
    // 2) Pull latest from Firestore into local Dexie
    await hydrateFromFirestore(userId);
    // 3) Ensure system tabs/windows exist
    await ensureSystemData(userId);
  } catch (error) {
    console.warn('Local data preparation partial failure:', error);
    // Don't throw — still load what we have locally
  }
  // Always init store from whatever is in Dexie, even if hydration failed
  await useStore.getState().init(userId);
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
