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

/**
 * Which way a rate into the system leans against Throughput, once they differ
 * by more than STABILITY_TOLERANCE: more coming in than finishing, or fewer.
 */
export type FlowLean = 'in-faster' | 'out-faster';

export interface FlowMetrics {
  wipByState: Record<string, number>;
  /** Active items in the latest snapshot */
  totalWip: number;
  /** Active items averaged over the period's span (time-weighted) */
  avgWip: number;
  wipViolations: WipViolation[];
  throughput: number;
  /** Items starting work per day: the growth of active + done */
  startRate: number;
  /** New requests per day: the growth of backlog + active + done */
  arrivalRate: number;
  /** From when work starts until it is done: average active WIP ÷ throughput */
  avgCycleTime: number;
  /** From when a request enters the backlog until it is done: average backlog + active WIP ÷ throughput */
  avgLeadTime: number;
  /** Start Rate against Throughput — what Cycle Time assumes is steady */
  cycleTimeLean: FlowLean | null;
  /** Arrival Rate against Throughput — what Lead Time assumes is steady */
  leadTimeLean: FlowLean | null;
  /**
   * The period ended with fewer items across every state than it began, so
   * more left without being done than arrived, and Arrival Rate reads 0
   */
  totalFell: boolean;
  /** The first place in the period where Done fell, or null */
  doneDecrease: DoneDecrease | null;
}

/**
 * Little's Law assumes a steady flow. A rate into the system further from
 * Throughput than this share of the larger of the two is flagged.
 */
export const STABILITY_TOLERANCE = 0.2;

/**
 * A pair of rates leans only when at least this many items came in and as
 * many finished over the period: a few items either way is a large share of
 * a small count. Of 10, 20 and 30, only 30 held false Lead Time warnings on
 * a simulated steady flow of about one item a day near 10 % of 30-day windows
 * (1–6 %, against 34–37 % at 20); fewer items than this never lean.
 */
export const MIN_STABILITY_ITEMS = 30;

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

/** Net change in a set of states' total across a snapshot window */
function netGrowth(states: WorkflowState[], sorted: Snapshot[]): number {
  if (sorted.length < 2) return 0;
  return sumCounts(states, sorted[sorted.length - 1]) - sumCounts(states, sorted[0]);
}

/** Calculate rate of change (items/day) for a set of states across a snapshot window */
function rateOfChange(states: WorkflowState[], sorted: Snapshot[]): number {
  const growth = netGrowth(states, sorted);
  if (growth <= 0) return 0;
  return growth / daySpanBetween(sorted[0].date, sorted[sorted.length - 1].date);
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

/**
 * Null while the two rates are within STABILITY_TOLERANCE of the larger; when
 * fewer than MIN_STABILITY_ITEMS came in or finished; and when nothing
 * finished: the time they qualify then shows "—" anyway.
 */
function flowLean(
  inRate: number,
  throughput: number,
  inItems: number,
  doneItems: number,
): FlowLean | null {
  if (throughput <= 0) return null;
  if (Math.min(inItems, doneItems) < MIN_STABILITY_ITEMS) return null;
  if (Math.abs(inRate - throughput) <= STABILITY_TOLERANCE * Math.max(inRate, throughput)) {
    return null;
  }
  return inRate > throughput ? 'in-faster' : 'out-faster';
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

  const backlogStates = workflow.filter((s) => s.category === 'backlog');
  const activeStates = workflow.filter((s) => s.category === 'active');
  const doneStates = workflow.filter((s) => s.category === 'done');
  const everyState = [...backlogStates, ...activeStates, ...doneStates];

  // WIP: sum of active state counts from latest snapshot
  const wipByState = Object.fromEntries(
    activeStates.map((s) => [s.id, latest.counts[s.id] ?? 0]),
  );
  const totalWip = Object.values(wipByState).reduce((a, b) => a + b, 0);

  // WIP violations from latest snapshot
  const wipViolations = detectWipViolations(workflow, latest);

  // Throughput: items completed per day
  const throughput = rateOfChange(doneStates, sorted);

  // Start rate: items starting work per day
  const startRate = rateOfChange([...activeStates, ...doneStates], sorted);

  // Arrival rate: new requests entering the backlog per day
  const arrivalRate = rateOfChange(everyState, sorted);

  // Items behind each rate, for the minimum volume a lean needs
  const doneItems = netGrowth(doneStates, sorted);
  const startedItems = netGrowth([...activeStates, ...doneStates], sorted);
  const arrivedItems = netGrowth(everyState, sorted);

  // Little's Law, average WIP / Throughput over the period. Cycle Time counts
  // the active states (work started → done); Lead Time adds the backlog
  // (request entered the backlog → done), so it includes the wait there.
  const avgWip = timeAverage(activeStates, sorted);
  const avgCycleTime = throughput > 0 ? avgWip / throughput : 0;
  const avgLeadTime =
    throughput > 0 ? timeAverage([...backlogStates, ...activeStates], sorted) / throughput : 0;

  return {
    wipByState,
    totalWip,
    avgWip,
    wipViolations,
    throughput,
    startRate,
    arrivalRate,
    avgCycleTime,
    avgLeadTime,
    cycleTimeLean: flowLean(startRate, throughput, startedItems, doneItems),
    leadTimeLean: flowLean(arrivalRate, throughput, arrivedItems, doneItems),
    totalFell: arrivedItems < 0,
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
    startRate: 0,
    arrivalRate: 0,
    avgCycleTime: 0,
    avgLeadTime: 0,
    cycleTimeLean: null,
    leadTimeLean: null,
    totalFell: false,
    doneDecrease: null,
  };
}
