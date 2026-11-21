// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.18.0 (DASH26 O11, R9, D4, O5): what a tile offers, from the list item.
// Badges and gates are cloud-only; a role not known yet gates nothing.

import { describe, it, expect } from 'vitest';
import { tileAccess, OWNER_ONLY_DELETE_REASON, VIEW_ONLY_REASON } from '../tile-access';

const OPEN = { badge: null, showShare: false, deleteBlockedReason: null, editBlockedReason: null };

describe('tileAccess', () => {
  it.each([
    ['owner', 3], ['editor', 3], ['viewer', 3], [undefined, undefined],
  ] as const)('local mode gates nothing and shows no badge (role %s, %s members)', (role, members) => {
    // A kept local copy of a shared cloud project still stores owner and members.
    expect(tileAccess('local', role, members)).toEqual(OPEN);
  });

  it('cloud, role not known yet (a project this browser is still creating): nothing gated, no Share, no badge', () => {
    expect(tileAccess('cloud', undefined, 2)).toEqual(OPEN);
  });

  it('cloud owner alone: Share, no badge', () => {
    expect(tileAccess('cloud', 'owner', 1)).toEqual({ ...OPEN, showShare: true });
  });

  it('cloud owner with members: Share and "Shared"', () => {
    expect(tileAccess('cloud', 'owner', 2)).toEqual({ ...OPEN, showShare: true, badge: 'Shared' });
  });

  it('cloud editor: "Shared", no Share, Delete disabled with the owner-only reason', () => {
    expect(tileAccess('cloud', 'editor', 2)).toEqual({ ...OPEN, badge: 'Shared', deleteBlockedReason: OWNER_ONLY_DELETE_REASON });
  });

  it('cloud viewer: "View only" alone, Delete and Edit disabled with their reasons', () => {
    expect(tileAccess('cloud', 'viewer', 3)).toEqual({
      badge: 'View only', showShare: false, deleteBlockedReason: OWNER_ONLY_DELETE_REASON, editBlockedReason: VIEW_ONLY_REASON,
    });
  });
});
