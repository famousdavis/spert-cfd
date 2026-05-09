// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// @vitest-environment jsdom
// (default vitest env is 'node' — this module touches window.location
// and sessionStorage so we need a DOM.)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureInviteTokenFromUrl,
  SESSION_KEY,
  QUERY_PARAM,
} from '../invite-capture';

// Helper: stub window.location.search without touching the real
// global Location. The component test environment (jsdom) provides
// `window`, but the search string is read-only via direct assignment.
function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });
}

describe('captureInviteTokenFromUrl', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the token and persists it when ?invite= is present', () => {
    setSearch(`?${QUERY_PARAM}=abc123`);
    expect(captureInviteTokenFromUrl(true)).toBe('abc123');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('abc123');
  });

  it('returns sessionStorage-resident token when URL has been stripped', () => {
    sessionStorage.setItem(SESSION_KEY, 'persisted');
    setSearch(''); // URL already stripped (e.g., post router.replace)
    expect(captureInviteTokenFromUrl(true)).toBe('persisted');
  });

  it('prefers URL token over sessionStorage on collision (re-capture wins)', () => {
    sessionStorage.setItem(SESSION_KEY, 'old');
    setSearch(`?${QUERY_PARAM}=new`);
    expect(captureInviteTokenFromUrl(true)).toBe('new');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('new');
  });

  it('returns null and writes nothing when no token anywhere', () => {
    setSearch('?other=foo');
    expect(captureInviteTokenFromUrl(true)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('short-circuits to null when enabled=false (flag-off contract)', () => {
    setSearch(`?${QUERY_PARAM}=ignored`);
    expect(captureInviteTokenFromUrl(false)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('is idempotent — repeated calls return the same token', () => {
    setSearch(`?${QUERY_PARAM}=stable`);
    const a = captureInviteTokenFromUrl(true);
    const b = captureInviteTokenFromUrl(true);
    expect(a).toBe('stable');
    expect(b).toBe('stable');
  });

  it('preserves other query params when extracting the invite token', () => {
    // The function does not mutate the URL — only reads from it.
    setSearch(`?ref=email&${QUERY_PARAM}=xyz&utm=launch`);
    expect(captureInviteTokenFromUrl(true)).toBe('xyz');
    // window.location.search unchanged
    expect(window.location.search).toBe(`?ref=email&${QUERY_PARAM}=xyz&utm=launch`);
  });
});
