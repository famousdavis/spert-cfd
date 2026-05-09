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
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  microsoftProvider,
  isFirebaseConfigured,
} from '@/lib/firebase';
import { callClaimPendingInvitations } from '@/lib/callables';
import {
  TOS_VERSION,
  APP_ID,
  LS_TOS_WRITE_PENDING,
} from '@/lib/constants';
import { PROFILES_COL } from '@/lib/firestore-helpers';
import { INVITATIONS_ENABLED } from '@/lib/feature-flags';
import { denormalizeLastFirst } from '@/lib/auth-name';
import {
  hasAcceptedCurrentTos,
  recordLocalAcceptance,
  setWritePending,
  clearLocalConsent,
} from '@/lib/consent';
import { runSignOutCleanup } from '@/lib/sign-out-cleanup-registry';
import { ConsentModal } from '@/components/consent-modal';

interface AuthContextValue {
  user: User | null;
  isAuthLoading: boolean;
  /** Whether Firebase is configured for this build. Lets shell
   *  components (notably InvitationBanner) gate sign-in CTAs. */
  firebaseAvailable: boolean;
  /** Returns a promise so banner CTAs can await sign-in completion. */
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  /** User-visible sign-in error, or null if none. Set on auth/popup-blocked or generic failures. */
  signInError: string | null;
  clearSignInError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Write or update the consent record in Firestore.
 * Returns true on success (including case (c) where no write is needed);
 * returns false if the Firestore read/write fails. The caller uses this
 * signal to decide whether to clear LS_TOS_WRITE_PENDING and record
 * local acceptance — see A7.
 */
async function writeConsentRecord(user: User): Promise<boolean> {
  if (!db) return true;
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
    return true;
  } catch (err) {
    // Non-blocking: log and let user through, but return false so the
    // caller preserves LS_TOS_WRITE_PENDING for retry on next sign-in.
    console.error('Failed to write consent record:', (err as { code?: string }).code ?? 'unknown');
    return false;
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
    console.error('Failed to check consent record:', (err as { code?: string }).code ?? 'unknown');
    return true;
  }
}

/**
 * Write or update user profile for sharing UI email lookups
 * (non-blocking).
 *
 * v0.9.0: also mirrors the same payload into the suite-wide
 * spertsuite_profiles/{uid} collection so cross-app invitations from
 * the other SPERT apps (AHP, Gantt, Scheduler, ...) can resolve
 * email→uid server-side. Both writes use { merge: true } and are
 * fire-and-forget.
 *
 * displayName is normalized via denormalizeLastFirst() so Microsoft
 * AD's "Last, First Middle" convention is converted to "First Middle
 * Last" before it lands in either profile collection. Doing this at
 * write time means the Cloud Function never has to defensively
 * re-normalize — and any downstream consumer (the auto-add
 * notification email's From-line) renders cleanly without RFC 5322
 * quoting. Mirrors the same fix the function applies to fresh tokens.
 */
function writeUserProfile(user: User): void {
  if (!db) return;
  const payload = {
    displayName: denormalizeLastFirst(user.displayName ?? ''),
    email: (user.email ?? '').toLowerCase(),
    photoURL: user.photoURL ?? null,
    updatedAt: serverTimestamp(),
  };
  setDoc(doc(db, PROFILES_COL, user.uid), payload, { merge: true }).catch(
    (err) => {
      console.error(
        'Failed to update profile:',
        (err as { code?: string }).code ?? 'unknown',
      );
    },
  );
  setDoc(doc(db, 'spertsuite_profiles', user.uid), payload, {
    merge: true,
  }).catch((err) => {
    console.error(
      'Failed to update suite profile:',
      (err as { code?: string }).code ?? 'unknown',
    );
  });
}

/**
 * Fire-and-forget call to the claimPendingInvitations Cloud Function.
 * Idempotent — safe on every auth resolution (Branch A and Branch B).
 * On success, dispatches a window-level `spert:models-changed` event
 * so any mounted hook (notably useInvitationLanding) can transition
 * to the claimed state. The CFD project list also updates
 * automatically because FirestoreDriver.onProjectListChange's
 * membership query fires when the function writes members.{uid}.
 * Failures are logged silently — the user can still claim later (or
 * reload).
 *
 * Gated behind INVITATIONS_ENABLED so flag-off builds skip the
 * callable entirely (also avoids a crash if the function is
 * unavailable for any reason).
 *
 * Also gated on `firebaseUser.emailVerified`: Microsoft personal-
 * account users (@outlook.com, @hotmail.com, @live.com) reach this
 * code with `emailVerified === false` until they verify out-of-band.
 * Calling the CF in that state throws `failed-precondition` on every
 * auth resolution. The error is logged silently, but firing thousands
 * of doomed CF invocations is wasteful and noisy. Skipping is safe —
 * the user re-enters this flow on the next sign-in (when their email
 * eventually verifies). See Lesson 26.
 */
function claimPendingInvitationsAndNotify(firebaseUser: User): void {
  if (!INVITATIONS_ENABLED) return;
  if (!firebaseUser.emailVerified) return;
  void callClaimPendingInvitations()
    .then((data) => {
      const claimed = data?.claimed ?? [];
      if (claimed.length > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('spert:models-changed', { detail: { claimed } }),
        );
      }
    })
    .catch((err) => {
      console.error(
        'claimPendingInvitations failed:',
        (err as { code?: string }).code ?? (err as Error).message ?? 'unknown',
      );
    });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isFirebaseConfigured);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      // Peek the pending-write flag without consuming it. Consumption
      // happens only after the Firestore write succeeds (see A7).
      const isPendingWrite =
        typeof window !== 'undefined' &&
        localStorage.getItem(LS_TOS_WRITE_PENDING) === 'true';

      if (isPendingWrite) {
        // Branch A: User just accepted consent and signed in
        const success = await writeConsentRecord(firebaseUser);
        writeUserProfile(firebaseUser);
        claimPendingInvitationsAndNotify(firebaseUser);
        if (success) {
          // Firestore record exists (or was unnecessary) — finalize local state.
          localStorage.removeItem(LS_TOS_WRITE_PENDING);
          recordLocalAcceptance();
        }
        // On failure: leave LS_TOS_WRITE_PENDING set so the next sign-in
        // retries Branch A. Do NOT recordLocalAcceptance — the Firestore
        // record is the cross-app source of truth.
        setUser(firebaseUser);
        setIsAuthLoading(false);
      } else {
        // Branch B: Returning user (existing session on app load)
        if (hasAcceptedCurrentTos()) {
          // Fast path: local cache matches current version
          writeUserProfile(firebaseUser);
          claimPendingInvitationsAndNotify(firebaseUser);
          setUser(firebaseUser);
          setIsAuthLoading(false);
        } else {
          // Need to verify with Firestore
          const isValid = await checkReturningUserConsent(firebaseUser);
          if (isValid) {
            writeUserProfile(firebaseUser);
            claimPendingInvitationsAndNotify(firebaseUser);
            setUser(firebaseUser);
          } else {
            // Version mismatch or no record — sign out via centralized cleanup.
            // clearLocalConsent() must run BEFORE runSignOutCleanup — the
            // centralized helper does NOT clear LS_TOS_ACCEPTED_VERSION
            // (preserving it across user-initiated sign-out is intentional),
            // but a ToS-version-mismatch sign-out explicitly must clear it.
            clearLocalConsent();
            try {
              await runSignOutCleanup();
            } catch (err) {
              console.error('Sign-out cleanup failed:', (err as { code?: string }).code ?? err);
            }
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

    // Clear any stale error from a prior attempt.
    setSignInError(null);

    // Set pending write flag BEFORE auth fires
    setWritePending();

    try {
      await signInWithPopup(auth, firebaseProvider);
      // onAuthStateChanged will handle the rest (Branch A)
    } catch (err: unknown) {
      // Auth popup cancelled or error — local ToS acceptance persists per spec
      // spert_tos_write_pending also persists (will be consumed on next successful auth)
      const error = err as { code?: string };
      const code = error.code ?? 'unknown';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // Silent — user intentionally dismissed or double-clicked.
        return;
      }
      if (code === 'auth/popup-blocked') {
        setSignInError(
          'Popups are blocked. Please allow popups for this site and try again.',
        );
      } else {
        setSignInError('Sign-in failed. Please try again.');
      }
      console.error('Sign-in error:', code);
    }
  }, []);

  const clearSignInError = useCallback(() => {
    setSignInError(null);
  }, []);

  const handleSignInRequest = useCallback(
    async (provider: 'google' | 'microsoft'): Promise<void> => {
      if (hasAcceptedCurrentTos()) {
        // Already accepted — go straight to auth and propagate the
        // promise so banner CTAs can await completion.
        await initiateSignIn(provider);
      } else {
        // Need consent first — show modal. The promise resolves
        // immediately (consent flow has its own continuation path
        // via handleConsentAccept).
        setPendingProvider(provider);
        setShowConsentModal(true);
      }
    },
    [initiateSignIn],
  );

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
    try {
      await runSignOutCleanup();
    } catch (err) {
      // Cleanup is best-effort — log but do not re-throw. The underlying
      // firebaseSignOut is invoked inside runSignOutCleanup.
      console.error('Sign-out cleanup failed:', (err as { code?: string }).code ?? err);
    }
    // onAuthStateChanged (triggered by firebaseSignOut inside the cleanup) clears user state.
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthLoading,
    firebaseAvailable: isFirebaseConfigured,
    signInWithGoogle: () => handleSignInRequest('google'),
    signInWithMicrosoft: () => handleSignInRequest('microsoft'),
    signOut: handleSignOut,
    signInError,
    clearSignInError,
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
