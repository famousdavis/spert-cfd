// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { mapInvitationError } from '../invitation-errors';

function err(code: string, message?: string): unknown {
  return { code, message };
}

describe('mapInvitationError — resource-exhausted', () => {
  it('send context returns the per-day cap copy', () => {
    expect(mapInvitationError(err('functions/resource-exhausted'), 'send'))
      .toBe("You've reached today's invitation limit (25). Try again tomorrow.");
  });

  it('resend context returns the per-invitation cap copy (different)', () => {
    expect(mapInvitationError(err('functions/resource-exhausted'), 'resend'))
      .toBe('This invitation has reached its resend limit (5). Revoke and re-invite to start over.');
  });

  it('revoke context returns the per-day cap copy (revoke is not capped)', () => {
    // revokeInvite has no resource-exhausted path on the server today;
    // if it ever does, the copy currently mirrors send. This test
    // documents that intentional fallback.
    expect(mapInvitationError(err('functions/resource-exhausted'), 'revoke'))
      .toBe("You've reached today's invitation limit (25). Try again tomorrow.");
  });
});

describe('mapInvitationError — permission-denied', () => {
  it('send context: only owner can send', () => {
    expect(mapInvitationError(err('functions/permission-denied'), 'send'))
      .toBe('Only the project owner can send invitations.');
  });

  it('resend context: shared resend/revoke copy', () => {
    expect(mapInvitationError(err('functions/permission-denied'), 'resend'))
      .toBe('Only the project owner can resend or revoke this invitation.');
  });

  it('revoke context: shared resend/revoke copy', () => {
    expect(mapInvitationError(err('functions/permission-denied'), 'revoke'))
      .toBe('Only the project owner can resend or revoke this invitation.');
  });
});

describe('mapInvitationError — failed-precondition', () => {
  it('send context: prefers server message, falls back to generic', () => {
    expect(mapInvitationError(err('functions/failed-precondition'), 'send'))
      .toBe('The invitation request could not be processed.');
    expect(mapInvitationError(err('functions/failed-precondition', 'custom'), 'send'))
      .toBe('custom');
  });

  it('resend / revoke context: shared "no longer valid" copy', () => {
    expect(mapInvitationError(err('functions/failed-precondition'), 'resend'))
      .toBe('This invitation can no longer be resent or revoked.');
    expect(mapInvitationError(err('functions/failed-precondition'), 'revoke'))
      .toBe('This invitation can no longer be resent or revoked.');
  });
});

describe('mapInvitationError — unauthenticated', () => {
  it('returns the same re-sign-in copy across contexts', () => {
    const expected = 'Please sign in again before sending invitations.';
    expect(mapInvitationError(err('functions/unauthenticated'), 'send')).toBe(expected);
    expect(mapInvitationError(err('functions/unauthenticated'), 'resend')).toBe(expected);
    expect(mapInvitationError(err('functions/unauthenticated'), 'revoke')).toBe(expected);
  });
});

describe('mapInvitationError — not-found', () => {
  it('send context references the project', () => {
    expect(mapInvitationError(err('functions/not-found'), 'send'))
      .toBe('This project could not be found. Try reloading.');
  });

  it('resend / revoke context references the invitation', () => {
    expect(mapInvitationError(err('functions/not-found'), 'resend'))
      .toBe('This invitation no longer exists. Try reloading.');
    expect(mapInvitationError(err('functions/not-found'), 'revoke'))
      .toBe('This invitation no longer exists. Try reloading.');
  });
});

describe('mapInvitationError — invalid-argument', () => {
  it('prefers the server message when present', () => {
    expect(mapInvitationError(err('functions/invalid-argument', 'tokenId required'), 'send'))
      .toBe('tokenId required');
  });

  it('falls back to a generic message when the server message is empty', () => {
    expect(mapInvitationError(err('functions/invalid-argument'), 'send'))
      .toBe('One of the invitation fields is invalid.');
  });
});

describe('mapInvitationError — unmapped fallback', () => {
  it('send context: generic send copy', () => {
    expect(mapInvitationError({}, 'send'))
      .toBe('Something went wrong sending the invitations.');
  });

  it('resend context: generic resend copy', () => {
    expect(mapInvitationError({}, 'resend'))
      .toBe('Something went wrong resending the invitation.');
  });

  it('revoke context: generic revoke copy', () => {
    expect(mapInvitationError({}, 'revoke'))
      .toBe('Something went wrong revoking the invitation.');
  });

  it('uses the raw message when present (any context)', () => {
    expect(mapInvitationError({ message: 'network timeout' }, 'resend'))
      .toBe('network timeout');
  });
});

describe('mapInvitationError — defaults', () => {
  it("defaults context to 'send' when omitted", () => {
    expect(mapInvitationError(err('functions/permission-denied')))
      .toBe('Only the project owner can send invitations.');
  });
});
