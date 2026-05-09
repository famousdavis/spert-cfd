// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { User } from 'firebase/auth';

// ── Mocks ──────────────────────────────────────────────────
// `setDoc` is the assertion target — we capture every call's args.
// `doc` is a passthrough that records the (ref, collection, uid)
// triple so we can assert which collections were written to. The
// fake `db` is a sentinel value we can compare against.
//
// vi.hoisted is required: vi.mock factories are hoisted ABOVE the
// surrounding imports, so plain `const`s declared in module scope
// aren't visible inside the factory at hoist time. vi.hoisted runs
// the initializer at the same hoist phase.

type SetDocSig = (
  ref: unknown,
  payload: unknown,
  opts?: unknown,
) => Promise<void>;

const { setDoc, doc, serverTimestamp, dbHolder } = vi.hoisted(() => {
  // Typed signatures so setDoc.mock.calls[N][M] indexes correctly.
  // Casting the bare vi.fn() (instead of naming params in a function
  // body) sidesteps no-unused-vars warnings on `_ref`/`_payload`/`_opts`.
  const setDocFn = vi.fn() as Mock<SetDocSig>;
  setDocFn.mockImplementation(async () => {});
  const docFn = vi.fn((db: unknown, col: string, uid: string) => ({
    __ref: { col, uid, db },
  }));
  const serverTimestampFn = vi.fn(() => ({ __sentinel: 'serverTimestamp' }));
  // Wrap the db reference so tests can swap it without re-importing.
  const dbHolder = { db: { __mock: 'db' } as unknown };
  return { setDoc: setDocFn, doc: docFn, serverTimestamp: serverTimestampFn, dbHolder };
});

vi.mock('firebase/firestore', () => ({ setDoc, doc, serverTimestamp }));

vi.mock('../firebase', () => ({
  get db() {
    return dbHolder.db;
  },
}));

// ── Imports under test ─────────────────────────────────────
// (after the mocks so the dynamic getter resolves correctly)
import {
  writeUserProfile,
  PROFILES_COL,
  SUITE_PROFILES_COL,
} from '../profile-writes';

// ── Helpers ────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'user-abc',
    email: 'Alice@Example.COM',
    displayName: 'Davis, William',
    photoURL: 'https://example.com/avatar.png',
    ...overrides,
  } as User;
}

beforeEach(() => {
  setDoc.mockClear();
  doc.mockClear();
  serverTimestamp.mockClear();
  setDoc.mockImplementation(async () => {});
  dbHolder.db = { __mock: 'db' };
});

describe('writeUserProfile', () => {
  it('writes to BOTH the app-specific and suite-wide collections', () => {
    writeUserProfile(makeUser());
    expect(doc).toHaveBeenCalledWith(dbHolder.db, PROFILES_COL, 'user-abc');
    expect(doc).toHaveBeenCalledWith(dbHolder.db, SUITE_PROFILES_COL, 'user-abc');
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  it('lowercases the email address', () => {
    writeUserProfile(makeUser({ email: 'BOB@EXAMPLE.COM' }));
    const payload = setDoc.mock.calls[0][1] as { email: string };
    expect(payload.email).toBe('bob@example.com');
  });

  it('falls back to empty string when email is null', () => {
    writeUserProfile(makeUser({ email: null }));
    const payload = setDoc.mock.calls[0][1] as { email: string };
    expect(payload.email).toBe('');
  });

  it('denormalizes "Last, First" displayName via auth-name helper', () => {
    writeUserProfile(makeUser({ displayName: 'Davis, William' }));
    const payload = setDoc.mock.calls[0][1] as { displayName: string };
    expect(payload.displayName).toBe('William Davis');
  });

  it('passes displayName through unchanged when there is no comma', () => {
    writeUserProfile(makeUser({ displayName: 'William Davis' }));
    const payload = setDoc.mock.calls[0][1] as { displayName: string };
    expect(payload.displayName).toBe('William Davis');
  });

  it('preserves null photoURL', () => {
    writeUserProfile(makeUser({ photoURL: null }));
    const payload = setDoc.mock.calls[0][1] as { photoURL: string | null };
    expect(payload.photoURL).toBeNull();
  });

  it('attaches serverTimestamp() to updatedAt (Lesson 29 placement)', () => {
    writeUserProfile(makeUser());
    const payload = setDoc.mock.calls[0][1] as {
      updatedAt: { __sentinel?: string };
    };
    expect(payload.updatedAt).toEqual({ __sentinel: 'serverTimestamp' });
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it('uses { merge: true } on both writes', () => {
    writeUserProfile(makeUser());
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
    expect(setDoc.mock.calls[1][2]).toEqual({ merge: true });
  });

  it('writes the SAME payload to both collections (mirrored, not asymmetric)', () => {
    writeUserProfile(makeUser());
    expect(setDoc.mock.calls[0][1]).toEqual(setDoc.mock.calls[1][1]);
  });

  it('does NOT throw when setDoc rejects (background-write contract)', () => {
    setDoc.mockImplementation(async () => {
      throw Object.assign(new Error('boom'), { code: 'unavailable' });
    });
    // The function returns synchronously; the rejection lands inside
    // the .catch handler. We only need to assert no synchronous throw.
    expect(() => writeUserProfile(makeUser())).not.toThrow();
  });

  it('skips both writes when db is null (e.g. no Firebase config)', () => {
    dbHolder.db = null;
    writeUserProfile(makeUser());
    expect(setDoc).not.toHaveBeenCalled();
    expect(doc).not.toHaveBeenCalled();
  });
});
