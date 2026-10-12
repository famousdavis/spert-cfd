// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Snapshot, WorkflowState } from '@/types';
import { isValidDate, sortWorkflow, sortSnapshots, mergeSnapshots } from './dates';

// ── CSV Export ───────────────────────────────────────────

function escapeField(field: string): string {
  // Neutralize CSV formula injection (CWE-1236): prefix formula-triggering
  // characters with a tab so spreadsheets treat the field as text.
  const sanitized = /^[=+\-@]/.test(field) ? `\t${field}` : field;
  if (/[",\n\r\t]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function snapshotsToCSV(
  snapshots: Snapshot[],
  workflow: WorkflowState[],
  newestFirst = true,
): string {
  const sorted = sortWorkflow(workflow);
  const sortedSnapshots = sortSnapshots(snapshots, newestFirst);

  const header = ['Date', ...sorted.map((s) => escapeField(s.name))];
  const rows = sortedSnapshots.map((snap) => [
    snap.date,
    ...sorted.map((s) => String(snap.counts[s.id] ?? 0)),
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// ── CSV Parse ────────────────────────────────────────────

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine);

  return { headers, rows };
}

// ── Column Mapping ───────────────────────────────────────

export type ColumnTarget = 'date' | 'skip' | string; // string = stateId

export function suggestMapping(
  headers: string[],
  workflow: WorkflowState[],
): ColumnTarget[] {
  return headers.map((header) => {
    const lower = header.toLowerCase().trim();
    if (lower === 'date') return 'date';

    const match = workflow.find(
      (s) => s.name.toLowerCase() === lower,
    );
    if (match) return match.id;

    return 'skip';
  });
}

// ── Date Normalization ───────────────────────────────────

/** The date formats the importer accepts, worded for the user. */
export const CSV_DATE_FORMATS = 'YYYY-MM-DD or M/D/YYYY';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Normalize an imported date cell to `YYYY-MM-DD`, or null if it is not a real
 * date in an accepted format. US `M/D/YYYY` is accepted because Excel rewrites
 * an exported CSV's ISO dates that way when it re-saves the file in a US
 * locale. Month comes first: `5/10/2026` is May 10.
 *
 * The output always has the exact shape `validateProjectData()` requires.
 * `isValidDate()` alone is looser — `parseISO` also accepts `20261005`,
 * `2026-10` and `2026-W40`, which the importer used to store verbatim.
 */
export function normalizeImportDate(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  const us = US_DATE.exec(value);
  const iso = us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : value;
  return ISO_DATE.test(iso) && isValidDate(iso) ? iso : null;
}

// ── Apply Import ─────────────────────────────────────────

export interface ImportResult {
  snapshots: Snapshot[];
  importedCount: number;
  skippedCount: number;
  overwrittenCount: number;
  /** Date cells of rows skipped for an unrecognized date, as written in the file */
  skippedDates: string[];
  /** Earliest and latest imported dates, or null when nothing imports */
  dateRange: { first: string; last: string } | null;
}

export function applyCSVImport(
  parsed: ParsedCSV,
  mapping: ColumnTarget[],
  existingSnapshots: Snapshot[],
  workflowStateIds: string[],
): ImportResult {
  const dateColIndex = mapping.indexOf('date');
  if (dateColIndex === -1) {
    return {
      snapshots: existingSnapshots,
      importedCount: 0,
      skippedCount: parsed.rows.length,
      overwrittenCount: 0,
      skippedDates: [],
      dateRange: null,
    };
  }

  const existingDates = new Set(existingSnapshots.map((s) => s.date));
  let importedCount = 0;
  let skippedCount = 0;
  let overwrittenCount = 0;
  const skippedDates: string[] = [];

  const imported: Snapshot[] = [];

  for (const row of parsed.rows) {
    const date = normalizeImportDate(row[dateColIndex]);
    if (!date) {
      skippedCount++;
      skippedDates.push(row[dateColIndex] ?? '');
      continue;
    }

    const counts: Record<string, number> = {};
    for (const id of workflowStateIds) {
      counts[id] = 0;
    }

    for (let i = 0; i < mapping.length; i++) {
      const target = mapping[i];
      if (target === 'date' || target === 'skip') continue;
      if (workflowStateIds.includes(target)) {
        const val = parseInt(row[i], 10);
        counts[target] = isNaN(val) ? 0 : Math.max(0, val);
      }
    }

    if (existingDates.has(date)) {
      overwrittenCount++;
    }

    imported.push({ date, counts });
    importedCount++;
  }

  const chronological = sortSnapshots(imported);

  return {
    snapshots: mergeSnapshots(existingSnapshots, imported),
    importedCount,
    skippedCount,
    overwrittenCount,
    skippedDates,
    dateRange: chronological.length
      ? { first: chronological[0].date, last: chronological[chronological.length - 1].date }
      : null,
  };
}
