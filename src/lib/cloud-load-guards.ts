// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Checks on project documents read from the cloud (v0.16.4).
 *
 * WHY THIS EXISTS
 * ---------------
 * Any editor of a shared project can write its document, so what
 * `mapDocToProject` and the list paths read is not necessarily what this app
 * wrote. A name that is not text crashed the Projects tab for everyone the
 * document listed, and a snapshot date that is not a date crashed the chart.
 *
 * WHY NOT `validateProjectData`
 * -----------------------------
 * That validator rejects the whole document on any violation, which here
 * would make a project unloadable. These checks degrade instead: a snapshot
 * or workflow state that cannot be read is set aside, a field of the wrong
 * type is replaced by its default, and the rest of the project loads.
 *
 * WHAT THEY MUST ACCEPT
 * ---------------------
 * `saveProject` writes name, workflow, snapshots and settings back whole from
 * state, so anything set aside here is dropped from the cloud at the next
 * edit. That is acceptable only because every check accepts everything the
 * app's own writers produce: snapshot dates from the date input (gated by
 * `isValidDate`), CSV (`normalizeImportDate`) and JSON import
 * (`validateProjectData`'s `YYYY-MM-DD`); counts from `parseInt` (never NaN);
 * colors from the picker's hex check; categories from the editor. Shape only:
 * no length or range is checked. Nothing here throws or writes.
 */

import type { Project, Snapshot, WorkflowState, ProjectSettings, StateCategory } from '@/types';

/** A short name for the check that set something aside. Never the value. */
export type CloudSetAsideRule =
  | 'project-name'
  | 'workflow'
  | 'workflow-state'
  | 'snapshots'
  | 'snapshot'
  | 'snapshot-count'
  | 'settings';

/** Told of each value set aside, with the project it belongs to. */
export type CloudSetAsideReport = (projectId: string, rule: CloudSetAsideRule) => void;

const SNAPSHOT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const CATEGORIES: readonly StateCategory[] = ['backlog', 'active', 'done'];
/** Used for a state whose stored color cannot be drawn. */
export const FALLBACK_STATE_COLOR = '#9ca3af';

export const DEFAULT_SETTINGS: ProjectSettings = {
  gridSortNewestFirst: true,
  showWipWarnings: true,
  metricsPeriod: { kind: 'all' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Shown, never saved, for a project whose name is empty: one read from the
 * cloud as '' because it was not text. The app never writes an empty name
 * (create and rename both refuse one), so this keeps such a project
 * reachable rather than standing in for a real name.
 */
export const UNNAMED_PROJECT = 'Untitled project';

/** Text as written, or '' (reported) when it is not text. Absent reads as ''. */
export function cloudText(
  value: unknown,
  projectId: string,
  rule: CloudSetAsideRule,
  report?: CloudSetAsideReport,
): string {
  if (typeof value === 'string') return value;
  if (value !== undefined && value !== null) report?.(projectId, rule);
  return '';
}

function cloudState(raw: unknown, index: number): WorkflowState | null {
  if (!isRecord(raw)) return null;
  const { id, name, color, category, order, wipLimit } = raw;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  if (!CATEGORIES.includes(category as StateCategory)) return null;
  const goodWip = typeof wipLimit === 'number' && Number.isFinite(wipLimit) && wipLimit > 0;
  return {
    id,
    name,
    color: typeof color === 'string' && HEX_COLOR.test(color) ? color : FALLBACK_STATE_COLOR,
    category: category as StateCategory,
    order: typeof order === 'number' && Number.isFinite(order) ? order : index,
    ...(goodWip ? { wipLimit } : {}),
  };
}

/** Whether a state's color, order and WIP limit were all read as stored. */
function stateKeptWhole(raw: Record<string, unknown>, state: WorkflowState): boolean {
  return state.color === raw.color
    && state.order === raw.order
    && (raw.wipLimit === undefined || raw.wipLimit === null || state.wipLimit === raw.wipLimit);
}

/**
 * The workflow states: one that is not an object, or whose id, name or
 * category cannot be read, is set aside; a color, order or WIP limit of the
 * wrong shape is replaced by its default.
 */
export function cloudWorkflow(
  value: unknown,
  projectId: string,
  report?: CloudSetAsideReport,
): WorkflowState[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    report?.(projectId, 'workflow');
    return [];
  }
  const states: WorkflowState[] = [];
  value.forEach((raw, index) => {
    const state = cloudState(raw, index);
    if (!state || !stateKeptWhole(raw as Record<string, unknown>, state)) report?.(projectId, 'workflow-state');
    if (state) states.push(state);
  });
  return states;
}

function cloudCounts(raw: Record<string, unknown>): { counts: Record<string, number>; whole: boolean } {
  const counts: Record<string, number> = {};
  let whole = true;
  for (const [stateId, count] of Object.entries(raw)) {
    if (typeof count === 'number' && Number.isFinite(count)) counts[stateId] = count;
    else whole = false;
  }
  return { counts, whole };
}

/**
 * The snapshots: one that is not an object, whose date is not `YYYY-MM-DD`,
 * or whose counts are not an object is set aside; a count that is not a
 * finite number is left out (the chart and metrics read a missing count as 0).
 */
export function cloudSnapshots(
  value: unknown,
  projectId: string,
  report?: CloudSetAsideReport,
): Snapshot[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    report?.(projectId, 'snapshots');
    return [];
  }
  const snapshots: Snapshot[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.date !== 'string' || !SNAPSHOT_DATE.test(raw.date) || !isRecord(raw.counts)) {
      report?.(projectId, 'snapshot');
      continue;
    }
    const { counts, whole } = cloudCounts(raw.counts);
    if (!whole) report?.(projectId, 'snapshot-count');
    snapshots.push({ date: raw.date, counts });
  }
  return snapshots;
}

/** A setting as stored when `ok`; its default otherwise, reported unless it was absent. */
function setting<T>(stored: unknown, ok: boolean, fallback: T, onBad: () => void): T {
  if (ok) return stored as T;
  if (stored !== undefined && stored !== null) onBad();
  return fallback;
}

/**
 * The settings: a field of the wrong type is replaced by its default, and
 * an absent one takes its default silently. The metrics period is kept as
 * stored when it is an object: `normalizePeriod` already reads any period
 * it cannot use as "all".
 */
export function cloudSettings(
  value: unknown,
  projectId: string,
  report?: CloudSetAsideReport,
): ProjectSettings {
  if (value === undefined || value === null) return { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) {
    report?.(projectId, 'settings');
    return { ...DEFAULT_SETTINGS };
  }
  const { gridSortNewestFirst, showWipWarnings, metricsPeriod } = value;
  const onBad = () => report?.(projectId, 'settings');
  return {
    ...value,
    gridSortNewestFirst: setting(gridSortNewestFirst, typeof gridSortNewestFirst === 'boolean', DEFAULT_SETTINGS.gridSortNewestFirst, onBad),
    showWipWarnings: setting(showWipWarnings, typeof showWipWarnings === 'boolean', DEFAULT_SETTINGS.showWipWarnings, onBad),
    metricsPeriod: setting(metricsPeriod, isRecord(metricsPeriod), DEFAULT_SETTINGS.metricsPeriod, onBad),
  } as ProjectSettings;
}

/** The project's data fields read through the checks above. */
export function cloudProjectData(
  id: string,
  data: unknown,
  report?: CloudSetAsideReport,
): Pick<Project, 'name' | 'workflow' | 'snapshots' | 'settings'> {
  const d = isRecord(data) ? data : {};
  return {
    name: cloudText(d.name, id, 'project-name', report),
    workflow: cloudWorkflow(d.workflow, id, report),
    snapshots: cloudSnapshots(d.snapshots, id, report),
    settings: cloudSettings(d.settings, id, report),
  };
}
