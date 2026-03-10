// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
