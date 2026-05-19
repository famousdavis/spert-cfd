// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import type { Project } from '@/types';
import type { ProjectListItem } from '@/lib/storage-driver';
import { validateProjectData } from '@/lib/storage';
import { DATA_VERSION, needsProjectMigration, migrateProject } from '@/lib/migrations';
import { MAX_NAME_LENGTH } from '@/lib/constants';

// ── Types ─────────────────────────────────────────────────

/** All conflicts default to 'skip'. NEVER 'replace' as default. */
export type ConflictResolution = 'skip' | 'copy' | 'replace';

/**
 * A collision between an incoming project and an existing one.
 *
 * ID conflict scope: only meaningful when re-importing from the same cloud
 * workspace that retained original document IDs. Local solo-use produces
 * name conflicts on re-import (legacy single-project exports lacked the
 * `id` field, and shapeIncomingProject generates a fresh nanoid for those —
 * ID collisions are statistically impossible).
 */
export interface ImportConflict {
  incoming: Project;
  existing: ProjectListItem;
  type: 'id' | 'name';
}

/** Decision map: incoming project ID → resolution. */
export type ImportDecisions = Map<string, ConflictResolution>;

/**
 * Result of applying decisions to an import batch.
 * added[]    → driver.createProject (non-debounced; awaited; failures rolled back)
 * replaced[] → driver.saveProject   (debounced 500ms cloud; fire-and-forget; counts optimistic)
 * skipped[]  → incoming project IDs not applied
 */
export interface ApplyImportResult {
  added: Project[];
  replaced: Project[];
  skipped: string[];
}

/**
 * Parsed import file content.
 * 'ok': one or more valid projects ready for conflict detection.
 * 'invalid': file could not be parsed or validated; `reason` is shown in the error banner.
 *
 * The single-vs-multi distinction is derived from `projects.length` at the
 * call site; the discriminant is not needed here.
 */
export type ParsedImportData =
  | { kind: 'ok'; projects: Project[] }
  | { kind: 'invalid'; reason: string };

/**
 * Outcome of the full import merge (Layer 1 + apply + driver writes + rollback).
 *
 * ok: true  — Layer 1 passed; state updated; creates confirmed; replaces sent
 *             fire-and-forget. `addFailedCount` may be set on partial failure.
 * ok: false — Layer 1 drift (errorKind: 'drift') OR all adds failed with no
 *             replaces (errorKind: 'write-failed'). In the write-failed case
 *             the optimistic state was rolled back before this is returned.
 */
export interface ImportMergeOutcome {
  ok: boolean;
  added: number;
  replaced: number;
  skipped: number;
  addFailedCount?: number;
  errorKind?: 'drift' | 'write-failed';
}

/** Result of computeImportMerge. */
export type ComputeMergeResult =
  | { ok: true; result: ApplyImportResult }
  | { ok: false; errorKind: 'drift' };

/** Output of computeWriteRollback. */
export interface WriteRollbackPlan {
  failedAddedIds: Set<string>;
  addedOk: number;
  writeFailedCount: number;
}

/** Output of processImportData (parse + conflict-detect orchestration). */
export type ProcessedImportData =
  | { ok: true; incoming: Project[]; conflicts: ImportConflict[] }
  | { ok: false; reason: string };

// ── Helpers ───────────────────────────────────────────────

/**
 * Normalize a project name for case-insensitive, whitespace-tolerant
 * conflict detection. Returns lowercase trimmed name.
 */
export function normalizeProjectName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Shape an unknown raw object into a Project after validation passes.
 * Explicit field selection (no spread) to avoid prototype pollution and
 * to drop unknown fields. `_changeLog` is intentionally omitted; cloud
 * adds get a fresh `'created'` entry from createProject, replaces preserve
 * the existing log via merge:true + buildSavePayload exclusion.
 *
 * id generation:
 *   Legacy single-project exports (pre-multi-project export) lack an `id`
 *   field. Conflict detection requires one, so we generate via nanoid(8)
 *   when absent. Generated IDs cannot collide with existing project IDs,
 *   so files from this path can only trigger NAME conflicts. Files from
 *   newer multi-project workspace exports preserve their IDs and can
 *   trigger either ID or name conflicts.
 */
function shapeIncomingProject(raw: unknown): Project {
  const data = raw as Record<string, unknown>;
  const id =
    typeof data.id === 'string' && data.id.length > 0 ? data.id : nanoid(8);
  return {
    id,
    name: data.name as string,
    createdAt: data.createdAt as string,
    updatedAt: new Date().toISOString(),
    workflow: data.workflow as Project['workflow'],
    snapshots: data.snapshots as Project['snapshots'],
    settings: data.settings as Project['settings'],
    _version: DATA_VERSION,
  };
}

/**
 * Parse a JSON import file and validate every project against the
 * project schema, running migrations first if needed. Accepts:
 *   - a single project as a JSON object → kind: 'ok', projects.length === 1
 *   - multiple projects as a JSON array → kind: 'ok', projects.length >= 1
 * Returns kind: 'invalid' with a user-facing reason on any failure.
 */
export function classifyImportData(json: string): ParsedImportData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { kind: 'invalid', reason: 'Invalid JSON. The file may be corrupted.' };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { kind: 'invalid', reason: 'The file contains an empty project list.' };
    }
    const shaped: Project[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const element = parsed[i] as Record<string, unknown>;
      const migrated = needsProjectMigration(element) ? migrateProject(element) : element;
      if (!validateProjectData(migrated)) {
        const labelName =
          typeof (migrated as Record<string, unknown>)?.name === 'string' &&
          ((migrated as Record<string, unknown>).name as string).length > 0
            ? `"${(migrated as Record<string, unknown>).name as string}"`
            : `#${i + 1}`;
        return {
          kind: 'invalid',
          reason: `Project ${labelName} failed validation. The file may be from an incompatible version.`,
        };
      }
      shaped.push(shapeIncomingProject(migrated));
    }
    return { kind: 'ok', projects: shaped };
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const migrated = needsProjectMigration(obj) ? migrateProject(obj) : obj;
    if (!validateProjectData(migrated)) {
      return {
        kind: 'invalid',
        reason: 'The file does not appear to be a valid project export.',
      };
    }
    return { kind: 'ok', projects: [shapeIncomingProject(migrated)] };
  }

  return { kind: 'invalid', reason: 'Unrecognized file format.' };
}

/**
 * Detect ID and name collisions between incoming projects and current
 * workspace projects. ID match takes priority over name match — at most
 * one conflict is recorded per incoming project. Name comparison is
 * case-insensitive and whitespace-tolerant.
 */
export function detectImportConflicts(
  incoming: Project[],
  current: ProjectListItem[],
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const currentById = new Map(current.map((p) => [p.id, p]));
  const currentByName = new Map<string, ProjectListItem>();
  for (const p of current) {
    currentByName.set(normalizeProjectName(p.name), p);
  }

  for (const inc of incoming) {
    const idMatch = currentById.get(inc.id);
    if (idMatch) {
      conflicts.push({ incoming: inc, existing: idMatch, type: 'id' });
      continue;
    }
    const nameMatch = currentByName.get(normalizeProjectName(inc.name));
    if (nameMatch) {
      conflicts.push({ incoming: inc, existing: nameMatch, type: 'name' });
    }
  }

  return conflicts;
}

/**
 * Order-sensitive structural equality on two conflict arrays. Both arrays
 * are produced by detectImportConflicts in incoming-order, so a position
 * mismatch indicates the project list drifted between preview-open and
 * confirm-click (concurrent peer add/delete/rename).
 */
export function conflictsEqual(
  a: ImportConflict[],
  b: ImportConflict[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].incoming.id !== b[i].incoming.id) return false;
    if (a[i].existing.id !== b[i].existing.id) return false;
    if (a[i].type !== b[i].type) return false;
  }
  return true;
}

/**
 * Generate a unique "(copy)" / "(copy N)" name that doesn't collide with
 * the provided taken-names set (normalized). Truncates the base to fit
 * within MAX_NAME_LENGTH including the suffix.
 */
function generateUniqueCopyName(originalName: string, taken: Set<string>): string {
  const SUFFIX_RESERVE = ' (copy 999)'.length;
  const maxBaseLen = MAX_NAME_LENGTH - SUFFIX_RESERVE;
  const base =
    originalName.length > maxBaseLen ? originalName.slice(0, maxBaseLen) : originalName;

  const first = `${base} (copy)`;
  if (!taken.has(normalizeProjectName(first))) return first;
  for (let i = 2; i <= 999; i++) {
    const candidate = `${base} (copy ${i})`;
    if (!taken.has(normalizeProjectName(candidate))) return candidate;
  }
  // Adversarial fallback — guaranteed unique
  return `${base} (copy ${Date.now()})`;
}

/**
 * Apply user decisions to the incoming batch. Two-pass:
 *   Pass 1 — record adds (no conflict), replaces, skips. Track names that
 *            will exist post-import in `takenNames`.
 *   Pass 2 — generate unique copy names against the up-to-date `takenNames`.
 *
 * Replace semantics:
 *   - 'id' conflict: incoming.id === existing.id, write straight through.
 *   - 'name' conflict: id-swap incoming.id ← existing.id so saveProject
 *     overwrites the existing slot. Incoming data otherwise preserved.
 *
 * Copy semantics:
 *   - 'id' conflict: fresh nanoid (id must be unique). Name un-suffixed
 *     unless the original name also collides via takenNames.
 *   - 'name' conflict: incoming.id preserved. Name suffixed.
 *
 * Pitfall #7: `_changeLog` provenance — adds get cloud-side 'created' entry
 * from driver.createProject; replaces preserve existing via buildSavePayload
 * exclusion in cloud (local replaces wipe — documented limitation).
 */
export function applyImportDecisions(
  incoming: Project[],
  decisions: ImportDecisions,
  conflicts: ImportConflict[],
): ApplyImportResult {
  const result: ApplyImportResult = { added: [], replaced: [], skipped: [] };
  const conflictMap = new Map(conflicts.map((c) => [c.incoming.id, c]));

  // Identify which existing slots are being replaced — their names vacate.
  const replacedExistingIds = new Set<string>();
  for (const inc of incoming) {
    const c = conflictMap.get(inc.id);
    if (c && decisions.get(inc.id) === 'replace') {
      replacedExistingIds.add(c.existing.id);
    }
  }

  // Seed taken-names with conflict-peer existing names whose slots survive.
  // (Names of non-conflicting existing projects don't matter — they cannot
  // collide with any incoming name by definition.)
  const takenNames = new Set<string>();
  for (const c of conflicts) {
    if (!replacedExistingIds.has(c.existing.id)) {
      takenNames.add(normalizeProjectName(c.existing.name));
    }
  }

  // Pass 1: replaces, skips, no-conflict adds.
  for (const inc of incoming) {
    const c = conflictMap.get(inc.id);

    if (!c) {
      result.added.push(inc);
      takenNames.add(normalizeProjectName(inc.name));
      continue;
    }

    const decision = decisions.get(inc.id) ?? 'skip';

    if (decision === 'skip') {
      result.skipped.push(inc.id);
      continue;
    }

    if (decision === 'replace') {
      if (c.type === 'id') {
        result.replaced.push(inc);
      } else {
        result.replaced.push({ ...inc, id: c.existing.id });
      }
      takenNames.add(normalizeProjectName(inc.name));
      continue;
    }

    // decision === 'copy' — deferred to Pass 2
  }

  // Pass 2: copies. Generate fresh id (if id-conflict) and unique name.
  // Only suffix the name when the original would collide with a surviving
  // project — id-only conflicts where names differ keep the original name.
  for (const inc of incoming) {
    const c = conflictMap.get(inc.id);
    if (!c) continue;
    if ((decisions.get(inc.id) ?? 'skip') !== 'copy') continue;

    const id = c.type === 'id' ? nanoid(8) : inc.id;
    const normalized = normalizeProjectName(inc.name);
    const name = takenNames.has(normalized)
      ? generateUniqueCopyName(inc.name, takenNames)
      : inc.name;
    result.added.push({ ...inc, id, name });
    takenNames.add(normalizeProjectName(name));
  }

  return result;
}

/**
 * Layer 1: re-detect conflicts against the latest currentProjects and
 * compare against the snapshot taken when the preview was first shown.
 * If they don't match exactly, the project list drifted while the user
 * was reviewing — abort with 'drift'. Otherwise compute the apply result.
 *
 * Runs synchronously in the click-handler task. See architectural notes
 * for what this guard catches and what it doesn't.
 */
export function computeImportMerge({
  incoming,
  decisions,
  originalConflicts,
  currentProjects,
}: {
  incoming: Project[];
  decisions: ImportDecisions;
  originalConflicts: ImportConflict[];
  currentProjects: ProjectListItem[];
}): ComputeMergeResult {
  const freshConflicts = detectImportConflicts(incoming, currentProjects);
  if (!conflictsEqual(freshConflicts, originalConflicts)) {
    return { ok: false, errorKind: 'drift' };
  }
  const result = applyImportDecisions(incoming, decisions, freshConflicts);
  return { ok: true, result };
}

/**
 * Build the new project list from a prior list and an apply result.
 * Designed to run inside a React functional updater so concurrent peer
 * deletes/adds (delivered between Layer 1 and the render) are respected.
 *
 * Replace targets missing from `prev` are dropped silently from the UI
 * (Layer 2 — a concurrent delete vanished the slot). The driver write
 * still fires; cloud-mode behavior on that edge case is documented as a
 * known limitation.
 */
export function buildNewProjectList(
  prev: ProjectListItem[],
  result: ApplyImportResult,
): ProjectListItem[] {
  if (result.added.length === 0 && result.replaced.length === 0) {
    return prev;
  }

  const replacedMap = new Map(result.replaced.map((p) => [p.id, p]));
  const updated: ProjectListItem[] = prev.map((p) => {
    const r = replacedMap.get(p.id);
    if (!r) return p;
    // Preserve owner field (cloud mode); only the display name changes.
    return { ...p, name: r.name };
  });

  const existingIds = new Set(updated.map((p) => p.id));
  for (const p of result.added) {
    if (!existingIds.has(p.id)) {
      updated.push({ id: p.id, name: p.name });
    }
  }

  return updated;
}

/**
 * Process Promise.allSettled results from awaited create writes. Pairs
 * settled results with the corresponding added projects by index.
 */
export function computeWriteRollback(
  addedResults: PromiseSettledResult<void>[],
  added: Project[],
): WriteRollbackPlan {
  const failedAddedIds = new Set<string>();
  let addedOk = 0;
  let writeFailedCount = 0;
  for (let i = 0; i < addedResults.length; i++) {
    if (addedResults[i].status === 'rejected') {
      failedAddedIds.add(added[i].id);
      writeFailedCount++;
    } else {
      addedOk++;
    }
  }
  return { failedAddedIds, addedOk, writeFailedCount };
}

/**
 * True when the import should switch the active project to the newly added one.
 *
 * Conditions: single-project file with exactly one add, no replaces, and the
 * create write succeeded. Checked AFTER await so failedAddedIds is available.
 *
 * Note on the 'copy' case: if a single incoming project has a NAME conflict
 * and the user picks 'copy', result.added.length === 1 and incomingCount === 1,
 * so the auto-switch fires — the user lands on the copy. This is intentional:
 * the user just imported one project, they likely want to see it.
 */
export function shouldAutoSwitch(
  incomingCount: number,
  result: ApplyImportResult,
  failedAddedIds: Set<string>,
): boolean {
  return (
    incomingCount === 1 &&
    result.added.length === 1 &&
    result.replaced.length === 0 &&
    failedAddedIds.size === 0
  );
}

/**
 * True when the active project was replaced in LOCAL mode — signals
 * ActiveProjectContext to reload from storage via projectUpdateKey bump.
 *
 * Cloud mode uses the onProjectChange listener; incrementing the key there
 * would race the 500ms saveProject debounce and load pre-write data.
 * See the cloud-replace stale-data window in Known Limitations.
 */
export function shouldIncrementProjectKey(
  driverMode: 'local' | 'cloud',
  activeProjectId: string | null,
  replaced: Project[],
): boolean {
  return (
    driverMode === 'local' &&
    activeProjectId !== null &&
    replaced.some((p) => p.id === activeProjectId)
  );
}

/**
 * Format the success-banner text for a completed import. Each non-zero
 * count gets a comma-separated part. Pluralization is correct for n=1.
 * `addFailedCount` is appended as a separate sentence when present
 * (partial-failure case where some adds rolled back but replaces went
 * through; banner is still green because the user got partial value).
 */
export function buildBannerText(outcome: ImportMergeOutcome): string {
  const parts: string[] = [];
  if (outcome.added > 0) {
    parts.push(`Added ${outcome.added} project${outcome.added === 1 ? '' : 's'}`);
  }
  if (outcome.replaced > 0) {
    parts.push(`Replaced ${outcome.replaced} project${outcome.replaced === 1 ? '' : 's'}`);
  }
  if (outcome.skipped > 0) {
    parts.push(`Skipped ${outcome.skipped} project${outcome.skipped === 1 ? '' : 's'}`);
  }

  let message = parts.length > 0 ? `${parts.join(', ')}.` : '';

  if (outcome.addFailedCount && outcome.addFailedCount > 0) {
    const n = outcome.addFailedCount;
    const suffix = `${n} project${n === 1 ? '' : 's'} failed to import.`;
    message = message ? `${message} ${suffix}` : suffix;
  }

  return message || 'No changes were made.';
}

/**
 * Orchestration: parse JSON, detect conflicts against the current list.
 * Used by the import-state hook to transition idle → preview.
 */
export function processImportData(
  json: string,
  currentProjects: ProjectListItem[],
): ProcessedImportData {
  const parsed = classifyImportData(json);
  if (parsed.kind === 'invalid') {
    return { ok: false, reason: parsed.reason };
  }
  const conflicts = detectImportConflicts(parsed.projects, currentProjects);
  return { ok: true, incoming: parsed.projects, conflicts };
}
