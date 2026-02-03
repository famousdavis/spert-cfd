import { subDays, parseISO } from 'date-fns';
import type { WorkflowState, Snapshot, MetricsPeriod } from '@/types';
import { daySpanBetween, sortSnapshots } from './dates';

// ── Types ────────────────────────────────────────────────

export interface WipViolation {
  stateId: string;
  stateName: string;
  current: number;
  limit: number;
}

export interface FlowMetrics {
  wipByState: Record<string, number>;
  totalWip: number;
  wipViolations: WipViolation[];
  throughput: number;
  arrivalRate: number;
  avgLeadTime: number;
}

// ── Period Filtering ─────────────────────────────────────

export function filterSnapshotsByPeriod(
  snapshots: Snapshot[],
  period: MetricsPeriod,
): Snapshot[] {
  switch (period.kind) {
    case 'all':
      return snapshots;
    case 'days': {
      // Calculate cutoff relative to the latest snapshot, not current date
      if (snapshots.length === 0) return snapshots;
      const sorted = sortSnapshots(snapshots);
      const latestDate = parseISO(sorted[sorted.length - 1].date);
      const cutoff = subDays(latestDate, period.value);
      return snapshots.filter((s) => parseISO(s.date) >= cutoff);
    }
    case 'range':
      return snapshots.filter(
        (s) => s.date >= period.start && s.date <= period.end,
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

  // Little's Law: Lead Time = WIP / Throughput
  const avgLeadTime = throughput > 0 ? totalWip / throughput : 0;

  return {
    wipByState,
    totalWip,
    wipViolations,
    throughput,
    arrivalRate,
    avgLeadTime,
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
    wipViolations: [],
    throughput: 0,
    arrivalRate: 0,
    avgLeadTime: 0,
  };
}
