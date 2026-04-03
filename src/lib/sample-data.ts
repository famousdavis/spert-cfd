// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import type { Project, WorkflowState, Snapshot } from '@/types';
import { PRESET_COLORS } from './colors';

function makeWorkflow(): WorkflowState[] {
  return [
    { id: 'backlog', name: 'Backlog', color: PRESET_COLORS[0], category: 'backlog', order: 0 },
    { id: 'analysis', name: 'Analysis', color: PRESET_COLORS[3], category: 'active', wipLimit: 3, order: 1 },
    { id: 'dev', name: 'In Dev', color: PRESET_COLORS[8], category: 'active', wipLimit: 5, order: 2 },
    { id: 'review', name: 'Review', color: PRESET_COLORS[9], category: 'active', wipLimit: 2, order: 3 },
    { id: 'done', name: 'Done', color: PRESET_COLORS[6], category: 'done', order: 4 },
  ];
}

function sampleYear(): number {
  return Math.max(new Date().getFullYear(), 2026);
}

function makeSnapshots(): Snapshot[] {
  const stateIds = ['backlog', 'analysis', 'dev', 'review', 'done'];
  const year = sampleYear();

  const raw: Array<[string, number[]]> = [
    [`${year}-01-01`, [24, 0, 0, 0, 0]],
    [`${year}-01-02`, [22, 2, 0, 0, 0]],
    [`${year}-01-03`, [20, 2, 2, 0, 0]],
    [`${year}-01-04`, [18, 3, 2, 1, 0]],
    [`${year}-01-05`, [17, 2, 3, 1, 1]],
    [`${year}-01-08`, [15, 2, 4, 1, 2]],
    [`${year}-01-09`, [13, 3, 3, 2, 3]],
    [`${year}-01-10`, [11, 2, 4, 3, 4]],
    [`${year}-01-11`, [9, 3, 4, 2, 6]],
    [`${year}-01-12`, [7, 2, 5, 2, 8]],
    [`${year}-01-15`, [5, 2, 4, 3, 10]],
    [`${year}-01-16`, [3, 3, 3, 3, 12]],
    [`${year}-01-17`, [2, 2, 4, 2, 14]],
    [`${year}-01-18`, [0, 2, 3, 3, 16]],
  ];

  return raw.map(([date, counts]) => ({
    date,
    counts: Object.fromEntries(stateIds.map((id, i) => [id, counts[i]])),
  }));
}

/**
 * Creates a fresh sample project. Each call produces a new unique ID.
 */
export function createSampleProject(): Project {
  const now = new Date().toISOString();
  return {
    id: nanoid(8),
    name: 'Sample: 2-Week Sprint',
    createdAt: `${sampleYear()}-01-01T00:00:00.000Z`,
    updatedAt: now,
    workflow: makeWorkflow(),
    snapshots: makeSnapshots(),
    settings: {
      gridSortNewestFirst: true,
      showWipWarnings: true,
      metricsPeriod: { kind: 'all' },
    },
  };
}
