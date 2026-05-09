// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * User-profile writes for cross-app email→uid resolution. Mirrors the
 * same payload into two Firestore collections:
 *
 *   - PROFILES_COL (`spertcfd_profiles`) — this app's own profile
 *     row. Powers the in-app sharing UI's email lookups when the
 *     user invites a collaborator who has previously signed in here.
 *   - `spertsuite_profiles` — suite-wide row, written so cross-app
 *     invitations from the other SPERT apps (AHP, Gantt, Scheduler,
 *     MyScrumBudget, Forecaster, ...) can resolve email→uid via the
 *     shared spert-suite Firebase project. Added v0.9.0.
 *
 * displayName is denormalized at write time so Microsoft AD's
 * "Last, First Middle" convention becomes "First Middle Last"
 * before either row lands. The Cloud Function on the server side
 * also normalizes defensively (mailHeaders.ts) but doing it at write
 * time means the auto-add notification email's From-line renders
 * cleanly without RFC 5322 quoting workarounds.
 *
 * Both writes use `{ merge: true }` and are fire-and-forget. Errors
 * are logged but never thrown to the caller — this is a background
 * sync; an unverified Microsoft personal account or a transient
 * Firestore unavailability must not block sign-in.
 *
 * Extraction note (Lesson 57): the canonical pattern is to split
 * extraction across two commits (create new module, then wire +
 * remove old) for `git bisect` safety. CFD has exactly one caller
 * (auth-context.tsx) so a single commit is bisect-safe — there's no
 * intermediate state where two implementations of writeUserProfile
 * coexist. Preserved here as a deliberate deviation from the
 * canonical, documented in this commit's body.
 */

import { type User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { PROFILES_COL } from './firestore-helpers';
import { denormalizeLastFirst } from './auth-name';

const SUITE_PROFILES_COL = 'spertsuite_profiles';

interface ProfilePayload {
  displayName: string;
  email: string;
  photoURL: string | null;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

function buildPayload(user: User): ProfilePayload {
  return {
    displayName: denormalizeLastFirst(user.displayName ?? ''),
    email: (user.email ?? '').toLowerCase(),
    photoURL: user.photoURL ?? null,
    // serverTimestamp() is a FieldValue sentinel — must be assigned
    // last so it survives any payload spread/transformation upstream
    // (Lesson 29 — sanitizers strip FieldValues, so they must be
    // re-attached after sanitize, or set last as here).
    updatedAt: serverTimestamp(),
  };
}

export function writeUserProfile(user: User): void {
  if (!db) return;
  const payload = buildPayload(user);
  setDoc(doc(db, PROFILES_COL, user.uid), payload, { merge: true }).catch(
    (err) => {
      console.error(
        'Failed to update profile:',
        (err as { code?: string }).code ?? 'unknown',
      );
    },
  );
  setDoc(doc(db, SUITE_PROFILES_COL, user.uid), payload, {
    merge: true,
  }).catch((err) => {
    console.error(
      'Failed to update suite profile:',
      (err as { code?: string }).code ?? 'unknown',
    );
  });
}

// Re-exports used by tests so they don't have to duplicate the
// collection name string.
export { PROFILES_COL, SUITE_PROFILES_COL };
