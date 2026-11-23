// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R2, O56, O63): this browser's map in `spertcfd-project-prefs`.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LS_PROJECT_PREFS } from '../constants';
import { copyLocalPrefs, readLocalPrefs, writeLocalPref } from '../local-prefs';
import { createLocalStorageDriver } from '../local-storage-driver';
import { MAX_PROJECT_PREFS } from '../project-prefs';

const stored = () => JSON.parse(localStorage.getItem(LS_PROJECT_PREFS) ?? 'null');

beforeEach(() => localStorage.clear());

describe('writeLocalPref', () => {
  it('writes one field, and nothing on the project or in the index', () => {
    expect(writeLocalPref('a', 'color', 'blue')).toEqual({ prefs: { a: { color: 'blue' } } });
    expect(stored()).toEqual({ a: { color: 'blue' } });
    expect(localStorage.getItem('cfd-lab')).toBeNull();
  });

  it('two tabs lose nothing: each change reads the key again (O63)', () => {
    const tabA = createLocalStorageDriver();
    const tabB = createLocalStorageDriver();
    expect(tabA.getProjectPrefs()).toEqual({ status: 'ready', prefs: {} }); // both read before either writes
    expect(tabB.getProjectPrefs()).toEqual({ status: 'ready', prefs: {} });
    expect(tabA.setProjectPref('a', 'color', 'teal')).toBeNull();
    expect(tabB.setProjectPref('b', 'archived', true)).toBeNull();
    expect(tabA.setProjectPref('a', 'archived', true)).toBeNull();
    expect(stored()).toEqual({ a: { color: 'teal', archived: true }, b: { archived: true } });
  });

  it('removes the key when the last entry empties', () => {
    writeLocalPref('a', 'archived', true);
    writeLocalPref('a', 'archived', undefined);
    expect(localStorage.getItem(LS_PROJECT_PREFS)).toBeNull();
  });

  it('a refused id writes nothing', () => {
    for (const id of ['hasOwnProperty', '__proto__', '']) expect(writeLocalPref(id, 'archived', true)).toEqual({ refused: 'refused-id' });
    expect(localStorage.getItem(LS_PROJECT_PREFS)).toBeNull();
  });

  it('storage full is refused, said as "full", and the stored map is unchanged', () => {
    writeLocalPref('a', 'color', 'pink');
    // jsdom's localStorage keeps an own property as an item, so the prototype is spied.
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === LS_PROJECT_PREFS) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, k, v);
    });
    try {
      expect(writeLocalPref('b', 'archived', true)).toEqual({ refused: 'full' });
    } finally {
      spy.mockRestore();
    }
    expect(stored()).toEqual({ a: { color: 'pink' } });
  });

  it('the 1,000th entry is the last: a new one is refused as "cap", a change to a held one is not', () => {
    const full: Record<string, unknown> = {};
    for (let i = 0; i < MAX_PROJECT_PREFS; i++) full[`p${i}`] = { archived: true };
    localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify(full));
    expect(writeLocalPref('new', 'color', 'blue')).toEqual({ refused: 'cap' });
    expect('prefs' in writeLocalPref('p1', 'color', 'blue')).toBe(true);
  });

  it('reads an unreadable or tampered key as {} or its sound part', () => {
    localStorage.setItem(LS_PROJECT_PREFS, '{oops');
    expect(readLocalPrefs()).toEqual({});
    localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify({ a: { color: 'nope', archived: true }, hasOwnProperty: { archived: true } }));
    expect(readLocalPrefs()).toEqual({ a: { archived: true } });
  });
});

describe('copyLocalPrefs (R36)', () => {
  it('replaces those ids\' entries whole and keeps every other one', () => {
    writeLocalPref('keep', 'color', 'slate');
    writeLocalPref('a', 'color', 'pink');
    writeLocalPref('a', 'archived', true);
    expect('prefs' in copyLocalPrefs([['a', { color: 'teal' }], ['b', { archived: true }], ['toString', { archived: true }]])).toBe(true);
    expect(stored()).toEqual({ keep: { color: 'slate' }, a: { color: 'teal' }, b: { archived: true } });
  });
});
