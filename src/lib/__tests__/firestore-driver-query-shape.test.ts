// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';

// ── Firestore SDK mocks ─────────────────────────────────
//
// Arrow-wrapper pattern with `Parameters<typeof mockX>` tuple typing, as
// documented in cloud-migration.test.ts: vi.mock is hoisted above these
// declarations, so direct-pass (`where: mockWhere`) throws ReferenceError at
// module init via TDZ, and the tuple typing is what satisfies TS2556 against
// vitest 4.x. Do not "simplify" to direct-pass.

const mockWhere = vi.fn((..._args: unknown[]) => ({ __where: _args }));
const mockQuery = vi.fn((..._args: unknown[]) => ({ __query: _args }));
const mockCollection = vi.fn((_db: unknown, col: string) => ({ __col: col }));
const mockGetDocs = vi.fn(async () => ({ forEach: () => {} }));
const mockGetDoc = vi.fn(async () => ({ exists: () => false }));
const mockDoc = vi.fn((_db: unknown, col: string, id: string) => ({ __doc: `${col}/${id}` }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
  getDoc: (...args: Parameters<typeof mockGetDoc>) => mockGetDoc(...args),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  collection: (...args: Parameters<typeof mockCollection>) => mockCollection(...args),
  query: (...args: Parameters<typeof mockQuery>) => mockQuery(...args),
  where: (...args: Parameters<typeof mockWhere>) => mockWhere(...args),
  getDocs: (...args: Parameters<typeof mockGetDocs>) => mockGetDocs(...args),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
}));

// ── Import after mocks ──────────────────────────────────

import { createFirestoreDriver } from '../firestore-driver';
import { PROJECTS_COL } from '../firestore-helpers';

const UID = 'uid-under-test';
const FAKE_DB = {} as Firestore;

/**
 * Pins the SHAPE of the query this driver runs against the projects
 * collection, because that shape is a security boundary.
 *
 * `firestore.rules` constrains `list` on this collection to
 * `members[uid] in ['owner', 'editor', 'viewer']`, and Firestore permits a
 * list query only when its filter PROVES that constraint. Drop or widen this
 * filter and the query does not return more rows — it returns
 * PERMISSION_DENIED, and no project loads at all.
 *
 * Until 2026-08-19 the rule was `allow list: if isAuth()`, which let any
 * signed-in SPERT user read every project in the collection.
 *
 * ⚠️ WHY THIS EXISTS SEPARATELY from rules-tests/project-collections-list.test.ts
 * in the spert-landing-page repo: that suite runs the real rules against an
 * emulator, but it encodes this query as written and lives in ANOTHER
 * repository — it cannot fail when this driver changes. This is the half that
 * fails HERE, in the repo where the edit is made. Neither is redundant.
 */
describe('projects collection — query shape required by the Firestore list rule', () => {
  beforeEach(() => {
    mockWhere.mockClear();
    mockQuery.mockClear();
    mockCollection.mockClear();
  });

  it('loadProjectList filters by membership — never unfiltered', async () => {
    await createFirestoreDriver(UID, FAKE_DB).loadProjectList();

    // The full ordered call list, not toHaveBeenCalledWith: an ADDITIONAL
    // unconstrained query would pass the latter, and that is precisely the
    // regression that matters.
    expect(mockWhere.mock.calls).toEqual([
      [`members.${UID}`, 'in', ['owner', 'editor', 'viewer']],
    ]);
  });

  it('builds that query against the projects collection', async () => {
    await createFirestoreDriver(UID, FAKE_DB).loadProjectList();

    expect(mockCollection).toHaveBeenCalledWith(FAKE_DB, PROJECTS_COL);
    // query(collection, where) — a bare query(collection) is the LIST-1 shape.
    expect(mockQuery).toHaveBeenCalled();
    expect(mockQuery.mock.calls[0].length).toBeGreaterThan(1);
  });
});
