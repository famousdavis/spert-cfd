// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Translate a Firebase callable error into copy the owner can act on.
 * Falls back to the raw message for unmapped codes.
 *
 * `context` disambiguates error codes shared across callables — e.g.
 * resource-exhausted means the per-day 25-cap on send, but the per-
 * invitation 5-cap on resend; permission-denied / failed-precondition
 * also need different copy for resend/revoke vs. send.
 *
 * CFD does not ship the updateInvite callable (no isVoting concept),
 * so the AHP-only 'updateVoting' context is intentionally omitted.
 */
export type InvitationErrorContext = 'send' | 'resend' | 'revoke';

export function mapInvitationError(
  err: unknown,
  context: InvitationErrorContext = 'send',
): string {
  const code = (err as { code?: string }).code ?? '';
  const message = (err as { message?: string }).message ?? '';
  if (code === 'functions/resource-exhausted') {
    if (context === 'resend') {
      return 'This invitation has reached its resend limit (5). Revoke and re-invite to start over.';
    }
    return "You've reached today's invitation limit (25). Try again tomorrow.";
  }
  if (code === 'functions/permission-denied') {
    if (context === 'resend' || context === 'revoke') {
      return 'Only the project owner can resend or revoke this invitation.';
    }
    return 'Only the project owner can send invitations.';
  }
  if (code === 'functions/failed-precondition') {
    if (context === 'resend' || context === 'revoke') {
      return 'This invitation can no longer be resent or revoked.';
    }
    return message || 'The invitation request could not be processed.';
  }
  if (code === 'functions/unauthenticated') {
    return 'Please sign in again before sending invitations.';
  }
  if (code === 'functions/not-found') {
    if (context === 'resend' || context === 'revoke') {
      return 'This invitation no longer exists. Try reloading.';
    }
    return 'This project could not be found. Try reloading.';
  }
  if (code === 'functions/invalid-argument') {
    return message || 'One of the invitation fields is invalid.';
  }
  if (context === 'resend') {
    return message || 'Something went wrong resending the invitation.';
  }
  if (context === 'revoke') {
    return message || 'Something went wrong revoking the invitation.';
  }
  return message || 'Something went wrong sending the invitations.';
}
