// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Token-capture half of the ?invite= landing flow (Lesson 58). Splits
 * the responsibility into two pieces so each is independently testable:
 *
 *   - This module owns the sessionStorage write (durable across the
 *     OAuth popup round-trip and the consent-modal dance) and exposes
 *     a pure function callers can invoke without mocking the React
 *     tree.
 *   - useInvitationLanding still owns the URL strip (`router.replace`)
 *     because that requires the App Router context, and the React
 *     state-machine transitions that depend on the captured token.
 *
 * The hook calls captureInviteTokenFromUrl() once at the top of its
 * mount effect; this module never imports anything from `next/navigation`
 * so the function works under SSR, in unit tests, and during module load.
 */

import { INVITATIONS_ENABLED } from './feature-flags';

export const SESSION_KEY = 'spert:pendingInviteToken';
export const QUERY_PARAM = 'invite';

/**
 * Look for `?invite=<token>` in the current URL and persist the token
 * to sessionStorage. Returns the token (whether freshly captured or
 * already present in sessionStorage from a previous mount) so the
 * caller can transition straight to `pre_auth` without re-reading
 * storage.
 *
 *   enabled — defaults to INVITATIONS_ENABLED. Tests override directly
 *             instead of via the feature-flag module.
 *
 * Returns null when:
 *   - the flag is off,
 *   - SSR (no window),
 *   - sessionStorage is unavailable (private mode), or
 *   - no token is anywhere.
 *
 * Idempotent across calls: re-running on a stripped URL returns the
 * sessionStorage-resident token unchanged.
 */
export function captureInviteTokenFromUrl(
  enabled: boolean = INVITATIONS_ENABLED,
): string | null {
  if (!enabled) return null;
  if (typeof window === 'undefined') return null;

  // First check: ?invite= in the URL right now. If present, persist
  // it (the URL strip happens in the hook via router.replace).
  let token: string | null = null;
  try {
    token = new URLSearchParams(window.location.search).get(QUERY_PARAM);
  } catch {
    // URLSearchParams should never throw on a real Location, but
    // guard anyway to keep this module SSR/test-safe.
    token = null;
  }

  if (token) {
    try {
      sessionStorage.setItem(SESSION_KEY, token);
    } catch {
      // sessionStorage may be unavailable in private mode — non-fatal.
      // Returning the token is still useful: the caller can drive its
      // state machine for this tab even if persistence fails.
    }
    return token;
  }

  // Second check: a token from a previous capture survived the OAuth
  // round-trip and is sitting in sessionStorage. Return it so the
  // caller knows there's a pending invite even after the URL has
  // been stripped.
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
