// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  formatDate,
  formatDateShort,
  todayISO,
  daySpanBetween,
  isValidDate,
  sortSnapshots,
  sortWorkflow,
  mergeSnapshots,
} from '../dates';
import type { Snapshot, WorkflowState } from '@/types';

describe('formatDate', () => {
  it('formats ISO date to full display format', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
  });

  it('handles different months', () => {
    expect(formatDate('2024-12-25')).toBe('Dec 25, 2024');
  });
});

describe('formatDateShort', () => {
  it('formats ISO date to short display format', () => {
    expect(formatDateShort('2024-01-15')).toBe('Jan 15');
  });

  it('handles single-digit days', () => {
    expect(formatDateShort('2024-03-01')).toBe('Mar 1');
  });
});

describe('todayISO', () => {
  it('returns a valid ISO date string', () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\'s date', () => {
    const result = todayISO();
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});

describe('daySpanBetween', () => {
  it('calculates days between two dates', () => {
    expect(daySpanBetween('2024-01-01', '2024-01-08')).toBe(7);
  });

  it('floors to minimum of 1 for same day', () => {
    expect(daySpanBetween('2024-01-01', '2024-01-01')).toBe(1);
  });

  it('floors to minimum of 1 for partial days', () => {
    // Even with no actual difference, minimum is 1
    expect(daySpanBetween('2024-01-01', '2024-01-01')).toBeGreaterThanOrEqual(1);
  });

  it('handles longer spans', () => {
    expect(daySpanBetween('2024-01-01', '2024-01-15')).toBe(14);
  });
});

// Forced into a DST zone so this runs wherever the suite runs, CI's UTC
// included: local midnights across a change are 23 or 25 hours apart.
describe('daySpanBetween across a daylight-saving change (America/New_York)', () => {
  const savedTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('counts 9 whole days from 1 to 10 March 2026 (clocks went forward on the 8th)', () => {
    // Control: the zone must really change offset inside the window.
    expect(new Date(2026, 2, 1).getTimezoneOffset()).not.toBe(
      new Date(2026, 2, 10).getTimezoneOffset(),
    );
    expect(daySpanBetween('2026-03-01', '2026-03-10')).toBe(9);
  });

  it('counts 2 whole days from 31 October to 2 November 2026 (clocks went back on the 1st)', () => {
    expect(new Date(2026, 9, 31).getTimezoneOffset()).not.toBe(
      new Date(2026, 10, 2).getTimezoneOffset(),
    );
    expect(daySpanBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('isValidDate', () => {
  it('returns true for valid ISO date', () => {
    expect(isValidDate('2024-01-15')).toBe(true);
  });

  it('returns true for valid ISO date with time', () => {
    expect(isValidDate('2024-01-15T10:30:00.000Z')).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidDate('')).toBe(false);
  });

  it('returns false for invalid month', () => {
    expect(isValidDate('2024-13-01')).toBe(false);
  });

  it('returns false for invalid day', () => {
    expect(isValidDate('2024-01-32')).toBe(false);
  });
});

describe('sortSnapshots', () => {
  const snapshots: Snapshot[] = [
    { date: '2024-01-15', counts: {} },
    { date: '2024-01-01', counts: {} },
    { date: '2024-01-08', counts: {} },
  ];

  it('sorts chronologically by default (oldest first)', () => {
    const result = sortSnapshots(snapshots);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-08');
    expect(result[2].date).toBe('2024-01-15');
  });

  it('sorts newest first when specified', () => {
    const result = sortSnapshots(snapshots, true);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[1].date).toBe('2024-01-08');
    expect(result[2].date).toBe('2024-01-01');
  });

  it('does not mutate the original array', () => {
    const original = [...snapshots];
    sortSnapshots(snapshots);
    expect(snapshots).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortSnapshots([])).toEqual([]);
  });
});

describe('sortWorkflow', () => {
  const workflow: WorkflowState[] = [
    { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
    { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
    { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
  ];

  it('sorts by order field', () => {
    const result = sortWorkflow(workflow);
    expect(result[0].id).toBe('backlog');
    expect(result[1].id).toBe('dev');
    expect(result[2].id).toBe('done');
  });

  it('does not mutate the original array', () => {
    const original = [...workflow];
    sortWorkflow(workflow);
    expect(workflow).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortWorkflow([])).toEqual([]);
  });
});

describe('mergeSnapshots', () => {
  const base: Snapshot[] = [
    { date: '2024-01-01', counts: { a: 1 } },
    { date: '2024-01-02', counts: { a: 2 } },
  ];

  const incoming: Snapshot[] = [
    { date: '2024-01-02', counts: { a: 20 } }, // overwrites
    { date: '2024-01-03', counts: { a: 3 } }, // new
  ];

  it('merges snapshots by date', () => {
    const result = mergeSnapshots(base, incoming);
    expect(result).toHaveLength(3);
  });

  it('overwrites existing dates with incoming values', () => {
    const result = mergeSnapshots(base, incoming);
    const jan2 = result.find((s) => s.date === '2024-01-02');
    expect(jan2?.counts.a).toBe(20);
  });

  it('preserves non-overlapping dates from base', () => {
    const result = mergeSnapshots(base, incoming);
    const jan1 = result.find((s) => s.date === '2024-01-01');
    expect(jan1?.counts.a).toBe(1);
  });

  it('adds new dates from incoming', () => {
    const result = mergeSnapshots(base, incoming);
    const jan3 = result.find((s) => s.date === '2024-01-03');
    expect(jan3?.counts.a).toBe(3);
  });

  it('handles empty base', () => {
    const result = mergeSnapshots([], incoming);
    expect(result).toHaveLength(2);
  });

  it('handles empty incoming', () => {
    const result = mergeSnapshots(base, []);
    expect(result).toHaveLength(2);
  });
});
