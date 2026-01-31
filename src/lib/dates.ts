import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import type { Snapshot, WorkflowState } from '@/types';

/** Format an ISO date string for display: "Jan 15, 2024" */
export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}

/** Format an ISO date string for short display: "Jan 15" */
export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'MMM d');
}

/** Get today as YYYY-MM-DD */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Difference in days between two ISO date strings, minimum 1 */
export function daysBetween(a: string, b: string): number {
  return Math.abs(differenceInDays(parseISO(a), parseISO(b)));
}

/** Day span between two ISO date strings as a float, floored to 1 */
export function daySpanBetween(a: string, b: string): number {
  return Math.max(
    1,
    (parseISO(b).getTime() - parseISO(a).getTime()) / (1000 * 60 * 60 * 24),
  );
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
