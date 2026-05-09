// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Centralized wrappers for the suite-wide Cloud Functions. Replaces
 * the prior pattern of lazy `getXxx()` factories returning `null` and
 * per-call-site null checks (Lesson 61): the Firebase SDK's response
 * to a missing Functions instance is a `TypeError: Cannot read
 * properties of null` deep inside `httpsCallable`, which is opaque to
 * the user and to logs.
 *
 * `requireFunctions()` throws an actionable error string instead, and
 * the named `callXxx` wrappers unwrap the `r.data` envelope so call
 * sites work with a clean Promise<Result>. Mirrors the Forecaster
 * post-PR2 callables module — same ergonomics.
 */

import { httpsCallable } from 'firebase/functions';
import {
  functions,
  type SendInvitationEmailInput,
  type SendInvitationEmailResult,
  type ClaimPendingInvitationsResult,
  type RevokeInviteResult,
  type ResendInviteResult,
} from './firebase';

function requireFunctions() {
  if (!functions) throw new Error('Firebase Functions not initialized.');
  return functions;
}

export async function callSendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<SendInvitationEmailResult> {
  const r = await httpsCallable<
    SendInvitationEmailInput,
    SendInvitationEmailResult
  >(requireFunctions(), 'sendInvitationEmail')(input);
  return r.data;
}

/**
 * Argless by design (Lesson 26 + Q2). The `emailVerified` short-circuit
 * lives in AuthContext.claimPendingInvitationsAndNotify so there is one
 * source of truth for who is allowed to invoke this CF; threading the
 * user object through the wrapper would duplicate the guard.
 */
export async function callClaimPendingInvitations(): Promise<ClaimPendingInvitationsResult> {
  const r = await httpsCallable<
    Record<string, never>,
    ClaimPendingInvitationsResult
  >(requireFunctions(), 'claimPendingInvitations')({});
  return r.data;
}

export async function callRevokeInvite(
  tokenId: string,
): Promise<RevokeInviteResult> {
  const r = await httpsCallable<{ tokenId: string }, RevokeInviteResult>(
    requireFunctions(),
    'revokeInvite',
  )({ tokenId });
  return r.data;
}

export async function callResendInvite(
  tokenId: string,
): Promise<ResendInviteResult> {
  const r = await httpsCallable<{ tokenId: string }, ResendInviteResult>(
    requireFunctions(),
    'resendInvite',
  )({ tokenId });
  return r.data;
}
