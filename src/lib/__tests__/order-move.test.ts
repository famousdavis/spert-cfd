// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.20.2 (DASH26 R2o, O53a): a drop is a move applied to the order read now.
// Each case is a worked example from the R2 pre-flight (exec-dash-r2
// 02-preflight-report.md, Deliverable 2), with what 3463be9 wrote beside it.
import { describe, it, expect } from 'vitest';
import { withStoredSlots, reorderShown, moveAmongShown, sameIds } from '../order-move';

const ids = (s: string) => s.split(' ');
const all = (s: string) => new Set(ids(s));
/** The cloud composition: the stored order's slots first, then the move among the shown ids. */
const cloud = (stored: string, held: string, shown: string, dragged: string, target: string) =>
  moveAmongShown(withStoredSlots(ids(stored), ids(held)), all(shown), dragged, target)?.join(' ') ?? null;

describe('withStoredSlots', () => {
  it('keeps every stored id in its slot, then appends the ids it lacks, in their order', () => {
    expect(withStoredSlots(ids('A C B'), ids('A B X Y'))).toEqual(ids('A C B X Y'));
  });

  it('reads a stored value that is not a list as none, and drops non-strings and repeats', () => {
    expect(withStoredSlots(undefined, ids('A B'))).toEqual(ids('A B'));
    expect(withStoredSlots({ 0: 'A' }, ids('B'))).toEqual(['B']);
    expect(withStoredSlots(['A', 3, null, 'B', 'A'], ids('B C'))).toEqual(ids('A B C'));
  });
});

describe('reorderShown', () => {
  it('gives the shown slots the new order and leaves every other id in its slot', () => {
    expect(reorderShown(ids('A X B C'), ids('C A B'))).toEqual(ids('C X A B'));
  });
});

describe('moveAmongShown', () => {
  it('puts the dragged id in the target\'s place, in both directions (dnd-kit\'s arrayMove)', () => {
    expect(moveAmongShown(ids('A B C'), all('A B C'), 'A', 'C')).toEqual(ids('B C A'));
    expect(moveAmongShown(ids('A B C'), all('A B C'), 'C', 'A')).toEqual(ids('C A B'));
  });

  it('is null when an id is not shown, or the two are the same', () => {
    expect(moveAmongShown(ids('A B C'), all('A B'), 'C', 'A')).toBeNull();
    expect(moveAmongShown(ids('A B C'), all('A B C'), 'Z', 'A')).toBeNull();
    expect(moveAmongShown(ids('A B C'), all('A B C'), 'B', 'B')).toBeNull();
  });
});

describe('the worked examples (cloud: withStoredSlots, then the move)', () => {
  it('P-A1: another device reordered; the stale tab\'s drop is applied to its order (3463be9 wrote B A C D)', () => {
    expect(cloud('D C B A', 'A B C D', 'A B C D', 'A', 'B')).toBe('D C A B');
  });

  it('P-A2: a project this tab has not listed keeps its slot (3463be9 wrote B A, losing C)', () => {
    expect(cloud('A C B', 'A B', 'A B', 'B', 'A')).toBe('B C A');
  });

  it('P-A2: a listed project the stored order lacks (a shared one) is placed by the drop', () => {
    expect(cloud('A B', 'A B X', 'A B X', 'X', 'A')).toBe('X A B');
  });

  it('P-A2: a deleted id still in the stored order keeps its slot, unseen', () => {
    expect(cloud('A Z B', 'A B', 'A B', 'B', 'A')).toBe('B Z A');
  });

  it('a hidden tile keeps its slot (v0.21.0\'s archived tiles)', () => {
    expect(cloud('A X B C', 'A X B C', 'A B C', 'C', 'A')).toBe('C X A B');
  });

  it('the order matters: the move made first and the stored slots after loses the drop', () => {
    const stored = ids('D C B A');
    const moved = moveAmongShown(ids('A B C D'), all('A B C D'), 'A', 'B')!;
    expect(withStoredSlots(stored, moved)).toEqual(stored); // the drop is gone
    expect(cloud('D C B A', 'A B C D', 'A B C D', 'A', 'B')).not.toBe(stored.join(' '));
  });
});

describe('sameIds', () => {
  it('holds only for the same ids, each as many times', () => {
    expect(sameIds(ids('A B C'), ids('C A B'))).toBe(true);
    expect(sameIds(ids('A B C'), ids('A B'))).toBe(false);
    expect(sameIds(ids('A B'), ids('A B C'))).toBe(false);
    expect(sameIds(ids('A B B'), ids('A A B'))).toBe(false);
    expect(sameIds(ids('A B C'), ids('A B D'))).toBe(false);
  });
});
