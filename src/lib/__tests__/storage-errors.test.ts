// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.19.0 (DASH26 R25, O24): recognising a refused local save because storage is full.

import { describe, it, expect } from 'vitest';
import { isStorageFullError, STORAGE_FULL_MESSAGE } from '../storage-errors';

describe('isStorageFullError', () => {
  it('jsdom\'s own quota error, a DOMException of jsdom\'s realm (never `instanceof` the global one)', () => {
    let thrown: unknown;
    try {
      for (let i = 0; ; i++) localStorage.setItem(`fill-${i}`, 'x'.repeat(1_000_000));
    } catch (e) {
      thrown = e;
    } finally {
      localStorage.clear();
    }
    expect((thrown as { name: string }).name).toBe('QuotaExceededError');
    expect(isStorageFullError(thrown)).toBe(true);
  });

  it.each([
    ['Chrome, Edge, Safari: QuotaExceededError', new DOMException('full', 'QuotaExceededError')],
    ['older Firefox: NS_ERROR_DOM_QUOTA_REACHED', Object.assign(new Error('full'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' })],
    ['legacy code 22 alone', { code: 22 }],
    ['Firefox code 1014 alone', { code: 1014 }],
  ])('%s', (_label, err) => {
    expect(isStorageFullError(err)).toBe(true);
  });

  it.each([
    ['a Firestore refusal (string code)', Object.assign(new Error('denied'), { code: 'permission-denied' })],
    ['another DOMException', new DOMException('nope', 'SecurityError')],
    ['null', null],
    ['a string', 'QuotaExceededError'],
  ])('not %s', (_label, err) => {
    expect(isStorageFullError(err)).toBe(false);
  });

  it('O24\'s words', () => {
    expect(STORAGE_FULL_MESSAGE).toBe("This browser's storage is full. Export a project, then delete one to make room.");
  });
});
