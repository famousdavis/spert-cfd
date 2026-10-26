// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { subDays, parseISO } from 'date-fns';
import type { WorkflowState, Snapshot, MetricsPeriod } from '@/types';
import { calendarDaysBetween, daySpanBetween, isValidDate, sortSnapshots } from './dates';

// ── Types ────────────────────────────────────────────────

export interface WipViolation {
  stateId: string;
  stateName: string;
  current: number;
  limit: number;
}

/** Two consecutive snapshots across which the done total went down */
export interface DoneDecrease {
  from: string;
  to: string;
}

export interface FlowMetrics {
  wipByState: Record<string, number>;
  /** Active items in the latest snapshot */
  totalWip: number;
  /** Active items averaged over the period's span (time-weighted) */
  avgWip: number;
  wipViolations: WipViolation[];
  throughput: number;
  arrivalRate: number;
  avgLeadTime: number;
  /** The first place in the period where Done fell, or null */
  doneDecrease: DoneDecrease | null;
}

// ── Period Filtering ─────────────────────────────────────

/**
 * The period the metrics actually use. No UI creates a `days` without a
 * positive whole number, a `range` without two valid dates in order, or an
 * unknown kind — they arrive by import or from a cloud document, which is not
 * validated — so they are read as 'all' rather than computed as an empty
 * window (WIP 0 on a full project).
 */
export function normalizePeriod(period: MetricsPeriod | undefined): MetricsPeriod {
  if (period?.kind === 'days' && Number.isInteger(period.value) && period.value > 0) {
    return period;
  }
  if (
    period?.kind === 'range' &&
    typeof period.start === 'string' &&
    typeof period.end === 'string' &&
    isValidDate(period.start) &&
    isValidDate(period.end) &&
    period.start <= period.end
  ) {
    return period;
  }
  return { kind: 'all' };
}

export function filterSnapshotsByPeriod(
  snapshots: Snapshot[],
  period: MetricsPeriod,
): Snapshot[] {
  const used = normalizePeriod(period);
  switch (used.kind) {
    case 'all':
      return snapshots;
    case 'days': {
      // Calculate cutoff relative to the latest snapshot, not current date
      if (snapshots.length === 0) return snapshots;
      const sorted = sortSnapshots(snapshots);
      const latestDate = parseISO(sorted[sorted.length - 1].date);
      const cutoff = subDays(latestDate, used.value);
      return snapshots.filter((s) => parseISO(s.date) >= cutoff);
    }
    case 'range':
      return snapshots.filter(
        (s) => s.date >= used.start && s.date <= used.end,
      );
  }
}

// ── Helpers ──────────────────────────────────────────────

/** Sum counts for a set of states from a single snapshot */
function sumCounts(states: WorkflowState[], snapshot: Snapshot): number {
  return states.reduce((sum, s) => sum + (snapshot.counts[s.id] ?? 0), 0);
}

/** Calculate rate of change (items/day) for a set of states across a snapshot window */
function rateOfChange(states: WorkflowState[], sorted: Snapshot[]): number {
  if (sorted.length < 2) return 0;

  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const growth = sumCounts(states, latest) - sumCounts(states, earliest);

  if (growth <= 0) return 0;
  return growth / daySpanBetween(earliest.date, latest.date);
}

/**
 * Time average of a set of states' total over the window: the area under the
 * line through the snapshots (trapezoids between consecutive ones), divided by
 * the same span rateOfChange uses. A plain mean of the snapshots would
 * over-weight a burst of closely spaced ones. One snapshot has no span: 0.
 */
function timeAverage(states: WorkflowState[], sorted: Snapshot[]): number {
  if (sorted.length < 2) return 0;

  let area = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const days = calendarDaysBetween(prev.date, next.date);
    area += ((sumCounts(states, prev) + sumCounts(states, next)) / 2) * days;
  }
  return area / daySpanBetween(sorted[0].date, sorted[sorted.length - 1].date);
}

/** The first consecutive pair whose done total fell — a CFD needs cumulative Done */
function findDoneDecrease(doneStates: WorkflowState[], sorted: Snapshot[]): DoneDecrease | null {
  for (let i = 1; i < sorted.length; i++) {
    if (sumCounts(doneStates, sorted[i]) < sumCounts(doneStates, sorted[i - 1])) {
      return { from: sorted[i - 1].date, to: sorted[i].date };
    }
  }
  return null;
}

// ── Calculations ─────────────────────────────────────────

export function calculateMetrics(
  workflow: WorkflowState[],
  snapshots: Snapshot[],
  period: MetricsPeriod,
): FlowMetrics {
  const filtered = filterSnapshotsByPeriod(snapshots, period);

  if (filtered.length === 0) {
    return emptyMetrics();
  }

  const sorted = sortSnapshots(filtered);
  const latest = sorted[sorted.length - 1];

  const activeStates = workflow.filter((s) => s.category === 'active');
  const doneStates = workflow.filter((s) => s.category === 'done');

  // WIP: sum of active state counts from latest snapshot
  const wipByState = Object.fromEntries(
    activeStates.map((s) => [s.id, latest.counts[s.id] ?? 0]),
  );
  const totalWip = Object.values(wipByState).reduce((a, b) => a + b, 0);

  // WIP violations from latest snapshot
  const wipViolations = detectWipViolations(workflow, latest);

  // Throughput: items completed per day
  const throughput = rateOfChange(doneStates, sorted);

  // Arrival rate: items entering the system per day
  const arrivalRate = rateOfChange([...activeStates, ...doneStates], sorted);

  // Little's Law: Lead Time = average WIP / Throughput, both over the period
  const avgWip = timeAverage(activeStates, sorted);
  const avgLeadTime = throughput > 0 ? avgWip / throughput : 0;

  return {
    wipByState,
    totalWip,
    avgWip,
    wipViolations,
    throughput,
    arrivalRate,
    avgLeadTime,
    doneDecrease: findDoneDecrease(doneStates, sorted),
  };
}

export function detectWipViolations(
  workflow: WorkflowState[],
  snapshot: Snapshot,
): WipViolation[] {
  return workflow
    .filter(
      (state): state is WorkflowState & { wipLimit: number } =>
        state.wipLimit !== undefined &&
        (snapshot.counts[state.id] ?? 0) > state.wipLimit,
    )
    .map((state) => ({
      stateId: state.id,
      stateName: state.name,
      current: snapshot.counts[state.id] ?? 0,
      limit: state.wipLimit,
    }));
}

function emptyMetrics(): FlowMetrics {
  return {
    wipByState: {},
    totalWip: 0,
    avgWip: 0,
    wipViolations: [],
    throughput: 0,
    arrivalRate: 0,
    avgLeadTime: 0,
    doneDecrease: null,
  };
}
