// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, microsoftProvider, isFirebaseConfigured } from '@/lib/firebase';
import { TOS_VERSION, APP_ID } from '@/lib/constants';
import {
  hasAcceptedCurrentTos,
  recordLocalAcceptance,
  setWritePending,
  consumeWritePending,
  clearLocalConsent,
} from '@/lib/consent';
import { ConsentModal } from '@/components/consent-modal';

interface AuthContextValue {
  user: User | null;
  isAuthLoading: boolean;
  signInWithGoogle: () => void;
  signInWithMicrosoft: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Write or update the consent record in Firestore (non-blocking on error) */
async function writeConsentRecord(user: User): Promise<void> {
  if (!db) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Case (a): New user — full write including appId
      await setDoc(userRef, {
        acceptedAt: serverTimestamp(),
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: TOS_VERSION,
        appId: APP_ID,
        authProvider: user.providerData[0]?.providerId ?? 'unknown',
      });
    } else {
      const data = snap.data();
      if (data.tosVersion !== TOS_VERSION) {
        // Case (b): Existing user, outdated version — merge WITHOUT appId
        await setDoc(
          userRef,
          {
            acceptedAt: serverTimestamp(),
            tosVersion: TOS_VERSION,
            privacyPolicyVersion: TOS_VERSION,
            authProvider: user.providerData[0]?.providerId ?? 'unknown',
          },
          { merge: true }
        );
      }
      // Case (c): Existing user, current version — skip write
    }
  } catch (err) {
    // Non-blocking: log but allow user through
    console.error('Failed to write consent record to Firestore:', err);
  }
}

/** Check returning user's consent version in Firestore */
async function checkReturningUserConsent(user: User): Promise<boolean> {
  if (!db) return true;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists() || snap.data().tosVersion !== TOS_VERSION) {
      return false; // Version mismatch or no record
    }

    // Cache locally for future fast-path
    recordLocalAcceptance();
    return true;
  } catch (err) {
    // Non-blocking: allow user through on Firestore error
    console.error('Failed to check consent record in Firestore:', err);
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isFirebaseConfigured);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'microsoft' | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      const isPendingWrite = consumeWritePending();

      if (isPendingWrite) {
        // Branch A: User just accepted consent and signed in
        await writeConsentRecord(firebaseUser);
        recordLocalAcceptance();
        setUser(firebaseUser);
        setIsAuthLoading(false);
      } else {
        // Branch B: Returning user (existing session on app load)
        if (hasAcceptedCurrentTos()) {
          // Fast path: local cache matches current version
          setUser(firebaseUser);
          setIsAuthLoading(false);
        } else {
          // Need to verify with Firestore
          const isValid = await checkReturningUserConsent(firebaseUser);
          if (isValid) {
            setUser(firebaseUser);
          } else {
            // Version mismatch or no record — sign out
            clearLocalConsent();
            if (auth) await firebaseSignOut(auth);
            // Don't setUser — user will see sign-in buttons
          }
          setIsAuthLoading(false);
        }
      }
    });

    return unsubscribe;
  }, []);

  const initiateSignIn = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!isFirebaseConfigured || !auth) return;

    const firebaseProvider = provider === 'google' ? googleProvider : microsoftProvider;
    if (!firebaseProvider) return;

    // Set pending write flag BEFORE auth fires
    setWritePending();

    try {
      await signInWithPopup(auth, firebaseProvider);
      // onAuthStateChanged will handle the rest (Branch A)
    } catch (err: unknown) {
      // Auth popup cancelled or error — local ToS acceptance persists per spec
      // spert_tos_write_pending also persists (will be consumed on next successful auth)
      const error = err as { code?: string };
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error('Sign-in error:', err);
      }
    }
  }, []);

  const handleSignInRequest = useCallback((provider: 'google' | 'microsoft') => {
    if (hasAcceptedCurrentTos()) {
      // Already accepted — go straight to auth
      initiateSignIn(provider);
    } else {
      // Need consent first — show modal
      setPendingProvider(provider);
      setShowConsentModal(true);
    }
  }, [initiateSignIn]);

  const handleConsentAccept = useCallback(() => {
    recordLocalAcceptance();
    setShowConsentModal(false);
    if (pendingProvider) {
      initiateSignIn(pendingProvider);
      setPendingProvider(null);
    }
  }, [pendingProvider, initiateSignIn]);

  const handleConsentCancel = useCallback(() => {
    setShowConsentModal(false);
    setPendingProvider(null);
    // Local acceptance (if any from prior attempt) persists per spec
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    await firebaseSignOut(auth);
    // onAuthStateChanged will clear user state
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthLoading,
    signInWithGoogle: () => handleSignInRequest('google'),
    signInWithMicrosoft: () => handleSignInRequest('microsoft'),
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showConsentModal && (
        <ConsentModal
          onAccept={handleConsentAccept}
          onCancel={handleConsentCancel}
        />
      )}
    </AuthContext.Provider>
  );
}
