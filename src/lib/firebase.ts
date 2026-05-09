// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Whether Firebase env vars are configured (controls sign-in UI visibility) */
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

// Only initialize Firebase when env vars are present — prevents
// auth/invalid-api-key errors during SSR/prerendering without .env.local
const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

export const auth = app ? getAuth(app) : null;
// memoryLocalCache avoids stale security rule decisions that persist in IndexedDB
// and cause "Missing or insufficient permissions" errors after rules change.
// See cloud-storage-guide ARCHITECTURE.md §21.5.
export const db = app
  ? initializeFirestore(app, { localCache: memoryLocalCache() })
  : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
export const microsoftProvider = app ? new OAuthProvider('microsoft.com') : null;

// ─── Cloud Functions (suite-wide, shared spert-suite project) ───
// Schemas defined in spert-landing-page/functions/src. Region us-central1.
// All factories return null when Firebase isn't configured so local-only
// dev / SSR / tests don't crash on a missing app.

const functionsInstance: Functions | null =
  app ? getFunctions(app, 'us-central1') : null;

export const functions = functionsInstance;

// ─── Callable input/output schemas ─────────────────────────

export interface SendInvitationEmailInput {
  /** Must be 'spertcfd' for this app — distinct from APP_ID 'spert-cfd'
   *  which is the consent-record discriminator. The callable's appId
   *  matches the Firestore collection prefix (`spertcfd_projects`). */
  appId: 'spertcfd';
  modelId: string;
  emails: string[];
  role: 'editor' | 'viewer';
  /** Always false for CFD — kept on the type for suite-shared schema
   *  compatibility. CFD has no voting-collaborator concept. */
  isVoting: boolean;
}

export interface SendInvitationEmailResult {
  added: string[];
  invited: string[];
  failed: Array<{
    email: string;
    /**
     * `invalid-format` is a CLIENT-SIDE rejection (parseBulkEmails
     * EMAIL_RE filter). It is never produced by the Cloud Function;
     * the modal merges it into the result so all rejection reasons
     * render in a single chip surface (Lesson 42).
     */
    reason:
      | 'invalid-format'
      | 'invalid-email'
      | 'already-member'
      | 'already-invited'
      | 'send-failed';
  }>;
}

export interface ClaimedInvitation {
  appId: string;
  modelId: string;
  modelName: string;
}

export interface ClaimPendingInvitationsResult {
  claimed: ClaimedInvitation[];
}

export interface RevokeInviteResult {
  revoked: true;
}

export interface ResendInviteResult {
  resent: true;
  emailSendCount: number;
}

// Callable invocations live in `./callables.ts` — see Lesson 61.
// `functions` is exported above for that module's `requireFunctions()`
// guard; nothing else in the app should import the Functions instance
// directly.
