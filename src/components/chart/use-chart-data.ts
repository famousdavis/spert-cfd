import { useMemo } from 'react';
import type { WorkflowState, Snapshot } from '@/types';
import { sortSnapshots, formatDateShort } from '@/lib/dates';

export interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  [stateId: string]: string | number;
}

export function useChartData(
  workflow: WorkflowState[],
  snapshots: Snapshot[],
): ChartDataPoint[] {
  return useMemo(() => {
    return sortSnapshots(snapshots).map((snap) => ({
      date: snap.date,
      dateFormatted: formatDateShort(snap.date),
      ...Object.fromEntries(
        workflow.map((state) => [state.id, snap.counts[state.id] ?? 0]),
      ),
    }));
  }, [workflow, snapshots]);
}
