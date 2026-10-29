// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import type { Snapshot, WorkflowState } from '@/types';

/**
 * Format with date-fns, or return the text as it is when it is not a real
 * date. date-fns `format` throws on an Invalid Date, and v0.16.4 reads a
 * `YYYY-MM-DD` that is not a calendar date (2026-02-30, say, which JSON
 * import accepts) as a date to show, not a reason to crash the grid.
 */
function formatOrAsIs(iso: string, pattern: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, pattern) : iso;
}

/** Format an ISO date string for display: "Jan 15, 2024" */
export function formatDate(iso: string): string {
  return formatOrAsIs(iso, 'MMM d, yyyy');
}

/** Format an ISO date string for short display: "Jan 15" */
export function formatDateShort(iso: string): string {
  return formatOrAsIs(iso, 'MMM d');
}

/** Get today as YYYY-MM-DD */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Calendar days from `a` to `b` (ISO date strings). Counting calendar days,
 * not milliseconds / 86,400,000, keeps a span across a daylight-saving change
 * whole: local midnights there are 23 or 25 hours apart.
 */
export function calendarDaysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Day span between two ISO date strings in calendar days, floored to 1 */
export function daySpanBetween(a: string, b: string): number {
  return Math.max(1, calendarDaysBetween(a, b));
}

/** Validate that a string is a valid ISO date */
export function isValidDate(s: string): boolean {
  return isValid(parseISO(s));
}

// ── Collection helpers ──────────────────────────────────

/** Sort snapshots chronologically (oldest first by default) */
export function sortSnapshots(snapshots: Snapshot[], newestFirst = false): Snapshot[] {
  return [...snapshots].sort((a, b) =>
    newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
  );
}

/** Sort workflow states by order */
export function sortWorkflow(workflow: WorkflowState[]): WorkflowState[] {
  return [...workflow].sort((a, b) => a.order - b.order);
}

/** Merge snapshots by date (later entries overwrite earlier ones with same date) */
export function mergeSnapshots(base: Snapshot[], incoming: Snapshot[]): Snapshot[] {
  const merged = new Map<string, Snapshot>();
  for (const snap of base) merged.set(snap.date, snap);
  for (const snap of incoming) merged.set(snap.date, snap);
  return Array.from(merged.values());
}
