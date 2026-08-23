// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  calculateMetrics,
  filterSnapshotsByPeriod,
  detectWipViolations,
} from '../calculations';
import type { WorkflowState, Snapshot, MetricsPeriod } from '@/types';

const workflow: WorkflowState[] = [
  { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
  { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', wipLimit: 5, order: 1 },
  { id: 'review', name: 'Review', color: '#8b5cf6', category: 'active', wipLimit: 2, order: 2 },
  { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 3 },
];

const snapshots: Snapshot[] = [
  { date: '2024-01-01', counts: { backlog: 20, dev: 0, review: 0, done: 0 } },
  { date: '2024-01-08', counts: { backlog: 12, dev: 4, review: 1, done: 3 } },
  { date: '2024-01-15', counts: { backlog: 5, dev: 3, review: 2, done: 10 } },
];

describe('filterSnapshotsByPeriod', () => {
  it('returns all snapshots for "all" period', () => {
    const result = filterSnapshotsByPeriod(snapshots, { kind: 'all' });
    expect(result).toHaveLength(3);
  });

  it('filters by date range', () => {
    const period: MetricsPeriod = {
      kind: 'range',
      start: '2024-01-05',
      end: '2024-01-10',
    };
    const result = filterSnapshotsByPeriod(snapshots, period);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-08');
  });

  it('returns empty for non-matching range', () => {
    const period: MetricsPeriod = {
      kind: 'range',
      start: '2025-01-01',
      end: '2025-12-31',
    };
    expect(filterSnapshotsByPeriod(snapshots, period)).toHaveLength(0);
  });
});

describe('detectWipViolations', () => {
  it('detects violations when count exceeds limit', () => {
    const snapshot: Snapshot = {
      date: '2024-01-15',
      counts: { backlog: 5, dev: 6, review: 3, done: 10 },
    };
    const violations = detectWipViolations(workflow, snapshot);
    expect(violations).toHaveLength(2);
    expect(violations[0].stateId).toBe('dev');
    expect(violations[0].current).toBe(6);
    expect(violations[0].limit).toBe(5);
    expect(violations[1].stateId).toBe('review');
  });

  it('returns empty when no violations', () => {
    const snapshot: Snapshot = {
      date: '2024-01-01',
      counts: { backlog: 20, dev: 3, review: 1, done: 0 },
    };
    expect(detectWipViolations(workflow, snapshot)).toHaveLength(0);
  });

  it('ignores states without WIP limits', () => {
    const snapshot: Snapshot = {
      date: '2024-01-01',
      counts: { backlog: 999, dev: 0, review: 0, done: 0 },
    };
    expect(detectWipViolations(workflow, snapshot)).toHaveLength(0);
  });
});

describe('calculateMetrics', () => {
  it('returns empty metrics for no snapshots', () => {
    const result = calculateMetrics(workflow, [], { kind: 'all' });
    expect(result.totalWip).toBe(0);
    expect(result.throughput).toBe(0);
    expect(result.avgLeadTime).toBe(0);
  });

  it('calculates WIP from latest snapshot', () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    // Latest: dev=3, review=2 → WIP=5
    expect(result.wipByState.dev).toBe(3);
    expect(result.wipByState.review).toBe(2);
    expect(result.totalWip).toBe(5);
  });

  it('calculates throughput as items done per day', () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    // Done went from 0 to 10 over 14 days → ~0.71/day
    expect(result.throughput).toBeCloseTo(10 / 14, 1);
  });

  it('calculates arrival rate', () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    // Non-backlog went from 0 to 15 over 14 days → ~1.07/day
    expect(result.arrivalRate).toBeCloseTo(15 / 14, 1);
  });

  it('calculates lead time via Little\'s Law', () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    // Lead Time = WIP / Throughput = 5 / (10/14) = 7
    expect(result.avgLeadTime).toBeCloseTo(7, 0);
  });

  it('detects WIP violations in latest snapshot', () => {
    const snapsWithViolation: Snapshot[] = [
      ...snapshots,
      { date: '2024-01-16', counts: { backlog: 4, dev: 6, review: 3, done: 11 } },
    ];
    const result = calculateMetrics(workflow, snapsWithViolation, { kind: 'all' });
    expect(result.wipViolations).toHaveLength(2);
  });
});

// ── The `days` window ────────────────────────────────────
// Untested until now: only 'all' and 'range' were exercised, so the whole
// `days` case of filterSnapshotsByPeriod was dark.

describe('filterSnapshotsByPeriod — the days window', () => {
  it('measures the window from the LATEST SNAPSHOT, not from today', () => {
    // Latest is 2024-01-15; a 10-day window starts at 2024-01-05.
    // Anchoring to the latest snapshot is what keeps this assertion stable
    // as real time passes — anchoring to `new Date()` would not.
    const result = filterSnapshotsByPeriod(snapshots, { kind: 'days', value: 10 });
    expect(result.map((s) => s.date)).toEqual(['2024-01-08', '2024-01-15']);
  });

  it('keeps every snapshot when the window is wider than the data', () => {
    const result = filterSnapshotsByPeriod(snapshots, { kind: 'days', value: 365 });
    expect(result).toHaveLength(3);
  });

  it('returns the empty array unchanged rather than indexing into it', () => {
    // Guards `sorted[sorted.length - 1]` on an empty array, which
    // `noUncheckedIndexedAccess` would type as possibly-undefined but this
    // repo does not enable.
    expect(filterSnapshotsByPeriod([], { kind: 'days', value: 7 })).toEqual([]);
  });
});

// ── rateOfChange's two early returns ─────────────────────

describe('rateOfChange guards, observed through calculateMetrics', () => {
  it('reports zero rates from a single snapshot — no window to measure across', () => {
    const result = calculateMetrics(workflow, [snapshots[0]], { kind: 'all' });
    expect(result.throughput).toBe(0);
    expect(result.arrivalRate).toBe(0);
  });

  it('reports zero throughput when the done count does not increase', () => {
    const flat: Snapshot[] = [
      { date: '2024-02-01', counts: { backlog: 5, dev: 2, review: 1, done: 7 } },
      { date: '2024-02-08', counts: { backlog: 4, dev: 2, review: 1, done: 7 } },
    ];
    const result = calculateMetrics(workflow, flat, { kind: 'all' });
    expect(result.throughput).toBe(0);
  });

  it('reports zero throughput when the done count goes backwards', () => {
    const regressed: Snapshot[] = [
      { date: '2024-02-01', counts: { backlog: 5, dev: 2, review: 1, done: 9 } },
      { date: '2024-02-08', counts: { backlog: 4, dev: 2, review: 1, done: 6 } },
    ];
    expect(calculateMetrics(workflow, regressed, { kind: 'all' }).throughput).toBe(0);
  });
});

// ── Little's Law with nothing completing ─────────────────

describe("Little's Law divide guard", () => {
  it('returns 0 rather than dividing WIP by zero throughput', () => {
    // WIP is present and throughput is zero. Without the guard this is
    // Infinity. The 0 is a sentinel: metrics-panel.tsx renders
    // `avgLeadTime > 0 ? ... : '—'`, so the user sees a dash, not "0.0d".
    const stalled: Snapshot[] = [
      { date: '2024-02-01', counts: { backlog: 5, dev: 3, review: 2, done: 7 } },
      { date: '2024-02-08', counts: { backlog: 5, dev: 3, review: 2, done: 7 } },
    ];
    const result = calculateMetrics(workflow, stalled, { kind: 'all' });
    expect(result.totalWip).toBe(5);
    expect(result.throughput).toBe(0);
    expect(result.avgLeadTime).toBe(0);
    expect(Number.isFinite(result.avgLeadTime)).toBe(true);
  });
});

// ── A state absent from a snapshot's counts ──────────────
// This is the ordinary case, not an exotic one: add a workflow state after
// snapshots exist and every earlier snapshot lacks that key.
// validateProjectData requires counts values to be finite numbers but does
// NOT require a key per workflow state, so such a project is valid.
//
// The type system cannot see it. `counts: Record<string, number>` with
// `noUncheckedIndexedAccess` unset types `counts[id]` as `number`, never
// `number | undefined`, so every `?? 0` here is developer-supplied and
// compiler-invisible. Without them these values are NaN.

describe('a workflow state missing from a snapshot', () => {
  const withGap: Snapshot[] = [
    { date: '2024-03-01', counts: { backlog: 10, dev: 2, review: 1, done: 0 } },
    { date: '2024-03-08', counts: { backlog: 8, done: 4 } }, // dev and review absent
  ];

  it('counts a missing active state as zero WIP, not NaN', () => {
    const result = calculateMetrics(workflow, withGap, { kind: 'all' });
    expect(result.wipByState.dev).toBe(0);
    expect(result.wipByState.review).toBe(0);
    expect(result.totalWip).toBe(0);
    expect(Number.isNaN(result.totalWip)).toBe(false);
  });

  it('keeps throughput and arrival rate finite across the gap', () => {
    const result = calculateMetrics(workflow, withGap, { kind: 'all' });
    expect(Number.isFinite(result.throughput)).toBe(true);
    expect(Number.isFinite(result.arrivalRate)).toBe(true);
    expect(Number.isNaN(result.arrivalRate)).toBe(false);
  });

  it('does not report a WIP violation for a limited state that is absent', () => {
    // `dev` carries wipLimit 5 and is missing from counts. The guard reads
    // it as 0, and 0 never exceeds a positive limit.
    // NB the state must HAVE a wipLimit for this to be reached at all —
    // `state.wipLimit !== undefined &&` short-circuits first.
    const snapshot: Snapshot = { date: '2024-03-08', counts: { backlog: 8, done: 4 } };
    expect(detectWipViolations(workflow, snapshot)).toHaveLength(0);
  });
});
