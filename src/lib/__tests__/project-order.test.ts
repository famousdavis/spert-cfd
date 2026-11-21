// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.19.0 (DASH26 O22): where a positioned create puts its id in the stored order.

import { describe, it, expect } from 'vitest';
import { placeAfter } from '../project-order';

describe('placeAfter', () => {
  it('(a) the stored order is the base: only the new id moves, an order written elsewhere survives', () => {
    // The tab still shows S1, S2, S3; another device stored S2, S1, S3.
    expect(placeAfter(['s2', 's1', 's3'], ['s1', 's2', 's3'], 's1', 'c')).toEqual(['s2', 's1', 'c', 's3']);
  });

  it('a stored id this tab cannot read stays where it is', () => {
    expect(placeAfter(['a', 'unread', 'b'], ['a', 'b'], 'a', 'c')).toEqual(['a', 'c', 'unread', 'b']);
  });

  it('(b) a source not stored: the shown ids not yet stored, through the source, then the copy — the source does not move', () => {
    // On screen: own (stored), then shA and shB, unordered; cloning shB.
    expect(placeAfter(['own'], ['own', 'shA', 'shB', 'shC'], 'shB', 'c')).toEqual(['own', 'shA', 'shB', 'c']);
  });

  it('(b) with no stored order at all', () => {
    expect(placeAfter([], ['shA', 'shB'], 'shA', 'c')).toEqual(['shA', 'c']);
  });

  it('a source neither stored nor shown: appended', () => {
    expect(placeAfter(['a'], ['a'], 'gone', 'c')).toEqual(['a', 'c']);
  });

  it('the new id is never written twice', () => {
    expect(placeAfter(['a', 'c', 'b'], ['a', 'b'], 'b', 'c')).toEqual(['a', 'b', 'c']);
    expect(placeAfter([], ['a', 'c', 'b'], 'b', 'c')).toEqual(['a', 'b', 'c']);
  });
});
