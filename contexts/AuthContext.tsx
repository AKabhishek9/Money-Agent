'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
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
import { doc, setDoc, getDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_SECTIONS } from '@/lib/types';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(prev => {
        // Only update state if the user identity actually changed
        if (prev?.uid === u?.uid && prev?.email === u?.email) return prev;
        return u;
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const initializeUserData = async (user: FirebaseUser): Promise<void> => {
    const userRef = doc(db, 'users', user.uid);

    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) return; // Already initialized

      const batch = writeBatch(db);

      // Create user document
      batch.set(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      });

      // Create all default sections in a single atomic batch (not sequential)
      DEFAULT_SECTIONS.forEach((section) => {
        const sectionRef = doc(collection(db, 'sections'));
        batch.set(sectionRef, {
          ...section,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to initialize user data:', error);
      // Surface the error so the UI can show a retry option
      throw new Error(
        'We could not set up your account. Please check your connection and try again.'
      );
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await initializeUserData(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await initializeUserData(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await initializeUserData(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed.');
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await firebaseSignOut(auth);
  }, []);

  // Stable user reference to prevent cascading re-renders across the app
  const stableUser = useMemo(() => user, [user?.uid]);

  const value = useMemo(() => ({
    user: stableUser,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }), [stableUser, loading, error, signIn, signUp, signInWithGoogle, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
