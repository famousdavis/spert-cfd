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
