// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// @vitest-environment jsdom
//
// SPERT CFD had NO member profile lookup at all before v0.14.9 — sharing-modal
// rendered `m.uid === user?.uid ? 'You' : m.uid`, i.e. a raw 28-char Firebase
// Auth UID for every member except yourself. This is the read side that was
// missing; the write side (writeUserProfile dual-writing spertcfd_profiles +
// spertsuite_profiles) already existed.
//
// The suite mirror matters because the cross-app invitation Cloud Function
// resolves an invitee BY their spertsuite_profiles doc and then writes only
// members.{uid} — it never seeds a per-app profile. A member who has used
// another SPERT app but never opened CFD has ONLY the suite doc.
//
// Suite-wide sweep 2026-07-29; first found in SPERT Story Map v0.49.3.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above ordinary const declarations and execute
// while the module under test is imported, so fixture state must be hoisted too.
const h = vi.hoisted(() => {
  const state = {
    /** Docs keyed by "collection/id"; an absent key means exists() === false. */
    docs: {} as Record<string, Record<string, unknown>>,
    /** Every getDoc path, so read behaviour can be asserted. */
    reads: [] as string[],
    user: null as { uid: string; displayName?: string | null; email?: string | null } | null,
  };
  return {
    state,
    docSpy: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
    getDocSpy: async (ref: { path: string }) => {
      state.reads.push(ref.path);
      const data = state.docs[ref.path];
      return { exists: () => data !== undefined, data: () => data };
    },
  };
});

vi.mock('firebase/firestore', () => ({ doc: h.docSpy, getDoc: h.getDocSpy }));
vi.mock('@/lib/firebase', () => ({ db: {} as unknown }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: h.state.user }) }));

import { useMemberProfiles } from '../use-member-profiles';

const SELF = 'self-uid-00000000000000000';
const MEMBER = 'nT5V5xk8pcNHpHE7IjMxJtmQBPa2';

beforeEach(() => {
  h.state.reads = [];
  h.state.docs = {};
  h.state.user = { uid: SELF, displayName: 'William W Davis', email: 'davisw2@ufl.edu' };
});

describe('useMemberProfiles', () => {
  it('resolves a member from the per-app collection', async () => {
    h.state.docs[`spertcfd_profiles/${MEMBER}`] = {
      displayName: 'Local Profile',
      email: 'local@example.com',
    };

    const { result } = renderHook(() => useMemberProfiles([MEMBER]));

    await waitFor(() => {
      expect(result.current[MEMBER]?.displayName).toBe('Local Profile');
    });
    // Tier 2 must not be consulted when tier 1 hits.
    expect(h.state.reads).not.toContain(`spertsuite_profiles/${MEMBER}`);
  });

  it('falls back to spertsuite_profiles when the per-app profile is missing', async () => {
    h.state.docs[`spertsuite_profiles/${MEMBER}`] = {
      displayName: 'William W Davis',
      email: 'famousdavispmp@gmail.com',
    };

    const { result } = renderHook(() => useMemberProfiles([MEMBER]));

    await waitFor(() => {
      expect(result.current[MEMBER]?.displayName).toBe('William W Davis');
    });
    expect(result.current[MEMBER]?.email).toBe('famousdavispmp@gmail.com');
    expect(h.state.reads).toContain(`spertcfd_profiles/${MEMBER}`);
  });

  it('omits the uid entirely when neither profile exists', async () => {
    const { result } = renderHook(() => useMemberProfiles([MEMBER]));

    await waitFor(() => {
      expect(h.state.reads).toContain(`spertsuite_profiles/${MEMBER}`);
    });
    expect(result.current[MEMBER]).toBeUndefined();
  });

  it('resolves the current user from auth context with no Firestore read', async () => {
    const { result } = renderHook(() => useMemberProfiles([SELF]));

    await waitFor(() => {
      expect(result.current[SELF]?.displayName).toBe('William W Davis');
    });
    expect(h.state.reads).toEqual([]);
  });

  it('reads each uid independently across a mixed member list', async () => {
    h.state.docs[`spertcfd_profiles/${MEMBER}`] = { email: 'local@example.com' };

    const { result } = renderHook(() => useMemberProfiles([SELF, MEMBER]));

    await waitFor(() => {
      expect(result.current[MEMBER]?.email).toBe('local@example.com');
    });
    // Self short-circuits; only MEMBER hits Firestore, and only tier 1.
    expect(h.state.reads).toEqual([`spertcfd_profiles/${MEMBER}`]);
  });
});
