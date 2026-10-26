// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculateMetrics,
  filterSnapshotsByPeriod,
  detectWipViolations,
  normalizePeriod,
  STABILITY_TOLERANCE,
} from '../calculations';
import { createSampleProject } from '../sample-data';
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
    expect(result.avgCycleTime).toBe(0);
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

  it('calculates start rate', () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    // Non-backlog went from 0 to 15 over 14 days → ~1.07/day
    expect(result.startRate).toBeCloseTo(15 / 14, 1);
  });

  it('calculates cycle time via Little\'s Law', () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    // Cycle Time = average WIP / Throughput. WIP 0 → 5 → 5 at 7-day steps:
    // area (0+5)/2·7 + (5+5)/2·7 = 52.5 over 14 days = 3.75, and
    // 3.75 / (10/14) = 5.25. (Was 7 — the latest WIP, 5, not the average.)
    expect(result.avgCycleTime).toBeCloseTo(5.25, 10);
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
    expect(result.startRate).toBe(0);
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
    // `avgCycleTime > 0 ? ... : '—'`, so the user sees a dash, not "0.0d".
    const stalled: Snapshot[] = [
      { date: '2024-02-01', counts: { backlog: 5, dev: 3, review: 2, done: 7 } },
      { date: '2024-02-08', counts: { backlog: 5, dev: 3, review: 2, done: 7 } },
    ];
    const result = calculateMetrics(workflow, stalled, { kind: 'all' });
    expect(result.totalWip).toBe(5);
    expect(result.throughput).toBe(0);
    expect(result.avgCycleTime).toBe(0);
    expect(Number.isFinite(result.avgCycleTime)).toBe(true);
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

  it('keeps throughput and start rate finite across the gap', () => {
    const result = calculateMetrics(workflow, withGap, { kind: 'all' });
    expect(Number.isFinite(result.throughput)).toBe(true);
    expect(Number.isFinite(result.startRate)).toBe(true);
    expect(Number.isNaN(result.startRate)).toBe(false);
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

// ── Little's Law uses the period's average WIP ──────────
// Every earlier lead-time case used a series whose latest WIP could not be
// told apart from its average, so dividing the LATEST WIP by the period's
// throughput passed at 100 % line coverage.

/** Daily snapshots from 2026-02-01 (no daylight-saving change in any common zone) */
function daily(rows: Array<[dev: number, done: number]>): Snapshot[] {
  return rows.map(([dev, done], i) => ({
    date: `2026-02-${String(i + 1).padStart(2, '0')}`,
    counts: { backlog: 0, dev, review: 0, done },
  }));
}

describe("Little's Law with the period's average WIP", () => {
  it('uses the time-averaged WIP, not the latest day (Opus-1-2 series)', () => {
    // WIP 10 for nine days, 40 on the tenth; Done +2/day → throughput 2/d.
    const series = daily([
      [10, 0], [10, 2], [10, 4], [10, 6], [10, 8],
      [10, 10], [10, 12], [10, 14], [10, 16], [40, 18],
    ]);
    const result = calculateMetrics(workflow, series, { kind: 'all' });
    expect(result.throughput).toBe(2);
    expect(result.totalWip).toBe(40); // the WIP card still shows the latest day
    // Area: eight 1-day trapezoids of 10, then (10+40)/2 = 25 → 105 over 9 days.
    expect(result.avgWip).toBeCloseTo(105 / 9, 10);
    // ≈ 5.83 d. The latest WIP gave 20.0 d; a plain mean of snapshots, 6.5 d.
    expect(result.avgCycleTime).toBeCloseTo(105 / 18, 10);
  });

  it('weights WIP by time between snapshots, not by snapshot count', () => {
    // Three snapshots a day apart, then one eight days later.
    const irregular: Snapshot[] = [
      { date: '2026-02-01', counts: { backlog: 0, dev: 20, review: 0, done: 0 } },
      { date: '2026-02-02', counts: { backlog: 0, dev: 20, review: 0, done: 1 } },
      { date: '2026-02-03', counts: { backlog: 0, dev: 20, review: 0, done: 2 } },
      { date: '2026-02-11', counts: { backlog: 0, dev: 4, review: 0, done: 10 } },
    ];
    const result = calculateMetrics(workflow, irregular, { kind: 'all' });
    expect(result.throughput).toBe(1);
    // Area 20 + 20 + (20+4)/2·8 = 136 over 10 days = 13.6. The plain mean of
    // the four snapshots is 16; the latest WIP is 4.
    expect(result.avgWip).toBeCloseTo(13.6, 10);
    expect(result.avgCycleTime).toBeCloseTo(13.6, 10);
  });

  it('has no span with one snapshot, so Cycle Time stays 0 ("—")', () => {
    const result = calculateMetrics(workflow, [snapshots[2]], { kind: 'all' });
    expect(result.avgWip).toBe(0);
    expect(result.avgCycleTime).toBe(0);
  });

  it('does not invent a span from two snapshots on the same date', () => {
    // The 1-day floor keeps throughput finite here, but no time passed, so
    // there is no average WIP to divide.
    const sameDay: Snapshot[] = [
      { date: '2026-02-01', counts: { backlog: 0, dev: 5, review: 0, done: 3 } },
      { date: '2026-02-01', counts: { backlog: 0, dev: 5, review: 0, done: 7 } },
    ];
    const result = calculateMetrics(workflow, sameDay, { kind: 'all' });
    expect(result.throughput).toBe(4);
    expect(result.avgWip).toBe(0);
    expect(result.avgCycleTime).toBe(0);
  });
});

// ── A falling Done is reported, not repaired ─────────────

describe('a done total that goes down', () => {
  it('names the first pair of dates where it fell, and keeps today\'s rates', () => {
    // Done 12 → 20 → 3 (column cleared) → 5 → 4.
    const cleared = daily([[2, 12], [2, 20], [2, 3], [2, 5], [2, 4]]);
    const result = calculateMetrics(workflow, cleared, { kind: 'all' });
    expect(result.doneDecrease).toEqual({ from: '2026-02-02', to: '2026-02-03' });
    expect(result.throughput).toBe(0);
    expect(result.avgCycleTime).toBe(0);
  });

  it('sums every done state, so items moving Done → Released are not a decrease', () => {
    const twoDone: WorkflowState[] = [
      ...workflow,
      { id: 'released', name: 'Released', color: '#16a34a', category: 'done', order: 4 },
    ];
    const moved: Snapshot[] = [
      { date: '2026-02-01', counts: { backlog: 0, dev: 2, review: 0, done: 5, released: 0 } },
      { date: '2026-02-02', counts: { backlog: 0, dev: 2, review: 0, done: 2, released: 4 } },
    ];
    const result = calculateMetrics(twoDone, moved, { kind: 'all' });
    expect(result.doneDecrease).toBeNull();
    expect(result.throughput).toBe(1);
  });
});

// ── Cycle Time and Lead Time, as the owner teaches them ──
// Lead time runs from when a request enters the backlog until it is done;
// cycle time from when work starts until it is done. v0.15.25's "Lead Time"
// was Cycle Time by these definitions, and its "Arrival Rate" a start rate.

/** Daily snapshots from 2026-04-01, with a backlog */
function dailyWithBacklog(rows: Array<[backlog: number, dev: number, done: number]>): Snapshot[] {
  return rows.map(([backlog, dev, done], i) => ({
    date: `2026-04-${String(i + 1).padStart(2, '0')}`,
    counts: { backlog, dev, review: 0, done },
  }));
}

describe('Cycle Time and Lead Time', () => {
  it('counts the time a request waits in the backlog in Lead Time, not Cycle Time', () => {
    // Steady: 2 arrive, 2 start and 2 finish a day; 10 wait, 4 in progress.
    const steady = dailyWithBacklog([[10, 4, 0], [10, 4, 2], [10, 4, 4], [10, 4, 6], [10, 4, 8]]);
    const result = calculateMetrics(workflow, steady, { kind: 'all' });
    expect(result.throughput).toBe(2);
    expect(result.avgCycleTime).toBe(2); // 4 in progress ÷ 2/d
    expect(result.avgLeadTime).toBe(7); // (10 waiting + 4 in progress) ÷ 2/d
  });

  it("keeps v0.15.25's number as Cycle Time, and adds the backlog for Lead Time", () => {
    const result = calculateMetrics(workflow, snapshots, { kind: 'all' });
    expect(result.avgCycleTime).toBeCloseTo(5.25, 10);
    // Backlog + active 20 → 17 → 10 at 7-day steps: area (20+17)/2·7 +
    // (17+10)/2·7 = 224 over 14 days = 16, and 16 / (10/14) = 22.4.
    expect(result.avgLeadTime).toBeCloseTo(22.4, 10);
  });
});

describe('Start Rate and Arrival Rate', () => {
  it('tells work starting apart from requests arriving when the backlog grows', () => {
    // 3 requests arrive a day and 2 start: the backlog grows by 1 a day.
    const growing = dailyWithBacklog([[10, 4, 0], [11, 4, 2], [12, 4, 4], [13, 4, 6], [14, 4, 8]]);
    const result = calculateMetrics(workflow, growing, { kind: 'all' });
    expect(result.startRate).toBe(2);
    expect(result.arrivalRate).toBe(3);
  });

  it('reads Arrival Rate as 0 when more items were removed than arrived, and says so', () => {
    // 15 left the backlog, 10 of them finished: 5 were removed undone.
    const cancelled: Snapshot[] = [
      { date: '2026-05-01', counts: { backlog: 20, dev: 4, review: 0, done: 0 } },
      { date: '2026-05-11', counts: { backlog: 5, dev: 4, review: 0, done: 10 } },
    ];
    const result = calculateMetrics(workflow, cancelled, { kind: 'all' });
    expect(result.arrivalRate).toBe(0);
    expect(result.totalFell).toBe(true);
    // Nothing arrived, below the minimum volume: the fall is reported, not a lean
    expect(result.leadTimeLean).toBeNull();
  });

  it('does not report a fall when the total holds or grows', () => {
    const steady = dailyWithBacklog([[10, 4, 0], [10, 4, 2]]);
    expect(calculateMetrics(workflow, steady, { kind: 'all' }).totalFell).toBe(false);
  });
});

// ── Little's Law assumes a steady flow ───────────────────
// A pair of rates further apart than 20 % of the larger one leans. Ten days
// between two snapshots, so each rate is its growth ÷ 10.

function tenDays(
  from: { backlog: number; dev: number; done: number },
  to: { backlog: number; dev: number; done: number },
): Snapshot[] {
  return [
    { date: '2026-05-01', counts: { ...from, review: 0 } },
    { date: '2026-05-11', counts: { ...to, review: 0 } },
  ];
}

function leans(series: Snapshot[]) {
  const { throughput, startRate, arrivalRate, cycleTimeLean, leadTimeLean } =
    calculateMetrics(workflow, series, { kind: 'all' });
  return { throughput, startRate, arrivalRate, cycleTimeLean, leadTimeLean };
}

describe('stability: Start Rate against Throughput (Cycle Time)', () => {
  const from = { backlog: 100, dev: 20, done: 0 };

  it('does not lean when work starts exactly 20 % slower than it finishes', () => {
    expect(leans(tenDays(from, { backlog: 100, dev: 10, done: 50 }))).toEqual({
      throughput: 5, startRate: 4, arrivalRate: 4, cycleTimeLean: null, leadTimeLean: null,
    });
  });

  it('leans out-faster just past it', () => {
    const r = leans(tenDays(from, { backlog: 101, dev: 9, done: 50 }));
    expect(r.startRate).toBeCloseTo(3.9, 10);
    expect(r.arrivalRate).toBe(4); // the other pair stays at its edge
    expect(r.cycleTimeLean).toBe('out-faster');
    expect(r.leadTimeLean).toBeNull();
  });

  it('does not lean when work starts exactly 20 % faster than it finishes', () => {
    const r = leans(tenDays(from, { backlog: 100, dev: 30, done: 40 }));
    expect([r.throughput, r.startRate]).toEqual([4, 5]);
    expect(r.cycleTimeLean).toBeNull();
  });

  it('leans in-faster just past it', () => {
    const r = leans(tenDays(from, { backlog: 99, dev: 31, done: 40 }));
    expect(r.startRate).toBeCloseTo(5.1, 10);
    expect(r.arrivalRate).toBe(5);
    expect(r.cycleTimeLean).toBe('in-faster');
    expect(r.leadTimeLean).toBeNull();
  });
});

describe('stability: Arrival Rate against Throughput (Lead Time)', () => {
  const from = { backlog: 100, dev: 20, done: 0 };

  it('leans out-faster when requests arrive just over 20 % slower than they finish', () => {
    const r = leans(tenDays(from, { backlog: 99, dev: 10, done: 50 }));
    expect([r.throughput, r.startRate]).toEqual([5, 4]);
    expect(r.arrivalRate).toBeCloseTo(3.9, 10);
    expect(r.leadTimeLean).toBe('out-faster');
    expect(r.cycleTimeLean).toBeNull();
  });

  it('does not lean at exactly 20 % faster, and leans in-faster just past it', () => {
    const edge = leans(tenDays(from, { backlog: 100, dev: 30, done: 40 }));
    expect([edge.throughput, edge.arrivalRate]).toEqual([4, 5]);
    expect(edge.leadTimeLean).toBeNull();
    const past = leans(tenDays(from, { backlog: 101, dev: 30, done: 40 }));
    expect(past.arrivalRate).toBeCloseTo(5.1, 10);
    expect(past.leadTimeLean).toBe('in-faster');
    expect(past.cycleTimeLean).toBeNull();
  });

  it('does not lean when nothing finished — both times already show "—"', () => {
    const r = leans(tenDays(from, { backlog: 150, dev: 30, done: 0 }));
    expect([r.throughput, r.startRate, r.arrivalRate]).toEqual([0, 1, 6]);
    expect(r.cycleTimeLean).toBeNull();
    expect(r.leadTimeLean).toBeNull();
  });
});

// ── A minimum volume before a pair of rates can lean ─────
// A few items either way is a large share of a small count, so a pair leans
// only when at least MIN_STABILITY_ITEMS (30) came in AND finished.

describe('stability: a minimum volume', () => {
  it('holds back a lean that 20 % alone would show when few items moved', () => {
    const r = leans(tenDays({ backlog: 100, dev: 20, done: 0 }, { backlog: 100, dev: 15, done: 10 }));
    expect([r.throughput, r.startRate, r.arrivalRate]).toEqual([1, 0.5, 0.5]); // 50 % apart
    expect(r.cycleTimeLean).toBeNull();
    expect(r.leadTimeLean).toBeNull();
  });

  it('lets Start Rate lean at exactly 30 started, not at 29', () => {
    const from = { backlog: 100, dev: 50, done: 0 };
    const at30 = leans(tenDays(from, { backlog: 130, dev: 20, done: 60 })); // 30 started, 60 done
    expect([at30.startRate, at30.throughput]).toEqual([3, 6]);
    expect(at30.cycleTimeLean).toBe('out-faster');
    const at29 = leans(tenDays(from, { backlog: 129, dev: 21, done: 58 })); // 29 started, 58 done
    expect(at29.startRate).toBeCloseTo(2.9, 10);
    expect(at29.cycleTimeLean).toBeNull();
  });

  it('lets Arrival Rate lean at exactly 30 arrived, not at 29', () => {
    const from = { backlog: 100, dev: 50, done: 0 };
    const at30 = leans(tenDays(from, { backlog: 70, dev: 50, done: 60 })); // 30 arrived, 60 done
    expect([at30.arrivalRate, at30.startRate, at30.throughput]).toEqual([3, 6, 6]);
    expect(at30.leadTimeLean).toBe('out-faster');
    expect(at30.cycleTimeLean).toBeNull();
    const at29 = leans(tenDays(from, { backlog: 69, dev: 50, done: 60 }));
    expect(at29.arrivalRate).toBeCloseTo(2.9, 10);
    expect(at29.leadTimeLean).toBeNull();
  });
});

// ── The sample project a new user sees ───────────────────

describe('the sample project', () => {
  const sample = createSampleProject();

  it.each<[string, MetricsPeriod]>([
    ['All data', { kind: 'all' }],
    ['Last 7 days', { kind: 'days', value: 7 }],
    ['Last 14 days', { kind: 'days', value: 14 }],
    ['Last 30 days', { kind: 'days', value: 30 }],
    ['Last 90 days', { kind: 'days', value: 90 }],
  ])('flows steadily over %s: no stability warning, and not only for want of volume', (_, period) => {
    const m = calculateMetrics(sample.workflow, sample.snapshots, period);
    expect(m.throughput).toBeGreaterThan(0);
    // Within the tolerance on its own, so the floor is not what keeps it quiet
    const within = (rate: number) =>
      Math.abs(rate - m.throughput) <= STABILITY_TOLERANCE * Math.max(rate, m.throughput);
    expect(within(m.startRate)).toBe(true);
    expect(within(m.arrivalRate)).toBe(true);
    expect(m.cycleTimeLean).toBeNull();
    expect(m.leadTimeLean).toBeNull();
  });
});

// ── Day spans across daylight saving ─────────────────────
// The suite never crossed a DST change before. TZ is forced here so this
// runs in a DST zone wherever the suite runs, CI's UTC included.

describe('rates across a daylight-saving change (America/New_York)', () => {
  const savedTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('reports 18 items over 1–10 March 2026 as exactly 2.0/day', () => {
    // Control: the zone must really change offset inside the window
    // (DST began 8 March), or this test would pass for the wrong reason.
    expect(new Date(2026, 2, 1).getTimezoneOffset()).not.toBe(
      new Date(2026, 2, 10).getTimezoneOffset(),
    );
    const march: Snapshot[] = [
      { date: '2026-03-01', counts: { backlog: 18, dev: 0, review: 0, done: 0 } },
      { date: '2026-03-10', counts: { backlog: 0, dev: 0, review: 0, done: 18 } },
    ];
    // A millisecond span here is 8 days 23 hours, which gave 2.0093/day.
    expect(calculateMetrics(workflow, march, { kind: 'all' }).throughput).toBe(2);
  });
});

// ── Malformed periods are read as 'all' ──────────────────
// No UI creates these; they arrive by import or from an unvalidated cloud
// document. Each was computed as an empty window: WIP 0 on a full project.

describe('a period the metrics cannot use', () => {
  const malformed: Array<[string, unknown]> = [
    ['days with no value', { kind: 'days' }],
    ["days with value 'abc'", { kind: 'days', value: 'abc' }],
    ['days with value 0', { kind: 'days', value: 0 }],
    ['range with no bounds', { kind: 'range' }],
    ['range with an invalid start', { kind: 'range', start: 'not-a-date', end: '2024-01-10' }],
    ['range whose start is after its end', { kind: 'range', start: '2024-01-15', end: '2024-01-01' }],
    ['no period at all', undefined],
    ['an unknown kind', { kind: 'weeks', value: 2 }],
  ];

  it.each(malformed)('treats %s as all data', (_name, period) => {
    const all = calculateMetrics(workflow, snapshots, { kind: 'all' });
    expect(all.totalWip).toBe(5); // control: all data is not itself empty
    expect(calculateMetrics(workflow, snapshots, period as MetricsPeriod)).toEqual(all);
  });

  it('keeps a valid days period, including one the selector does not offer', () => {
    expect(normalizePeriod({ kind: 'days', value: 60 })).toEqual({ kind: 'days', value: 60 });
  });

  it('keeps a valid range', () => {
    const range: MetricsPeriod = { kind: 'range', start: '2024-01-05', end: '2024-01-10' };
    expect(normalizePeriod(range)).toEqual(range);
    expect(filterSnapshotsByPeriod(snapshots, range).map((s) => s.date)).toEqual(['2024-01-08']);
  });
});
