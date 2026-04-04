// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import type { Project, StorageIndex } from '@/types';
import { DATA_VERSION, migrateIndex, migrateProject, needsIndexMigration, needsProjectMigration } from './migrations';
import { MAX_NAME_LENGTH } from './constants';

// ── Keys ─────────────────────────────────────────────────

export const INDEX_KEY = 'cfd-lab';
export const PROJECT_PREFIX = 'cfd-lab-project-';

function projectKey(id: string): string {
  return `${PROJECT_PREFIX}${id}`;
}

// ── Default index ────────────────────────────────────────

function defaultIndex(): StorageIndex {
  return { version: DATA_VERSION, activeProjectId: null, projectIds: [] };
}

// ── Index operations ─────────────────────────────────────

export function loadIndex(): StorageIndex {
  if (typeof window === 'undefined') return defaultIndex();
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return defaultIndex();
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray(parsed.projectIds)
    ) {
      // Run migrations if needed
      if (needsIndexMigration(parsed)) {
        const migrated = migrateIndex(parsed);
        saveIndex(migrated);
        return migrated;
      }
      return parsed as StorageIndex;
    }
    return defaultIndex();
  } catch {
    return defaultIndex();
  }
}

export function saveIndex(index: StorageIndex): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ── Project operations ───────────────────────────────────

export function loadProject(id: string): Project | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(projectKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Run migrations if needed
    if (needsProjectMigration(parsed)) {
      const migrated = migrateProject(parsed);
      localStorage.setItem(projectKey(id), JSON.stringify(migrated));
      if (!validateProjectData(migrated)) return null;
      sanitizeCloudFields(migrated as unknown as Record<string, unknown>);
      return migrated;
    }

    if (!validateProjectData(parsed)) return null;
    sanitizeCloudFields(parsed as Record<string, unknown>);
    return parsed as Project;
  } catch {
    return null;
  }
}

export function saveProject(project: Project): void {
  if (typeof window === 'undefined') return;

  const toSave: Project = {
    ...project,
    _version: DATA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(projectKey(project.id), JSON.stringify(toSave));
}

export function deleteProject(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(projectKey(id));

  const index = loadIndex();
  index.projectIds = index.projectIds.filter((pid) => pid !== id);
  if (index.activeProjectId === id) {
    index.activeProjectId = index.projectIds[0] ?? null;
  }
  saveIndex(index);
}

// ── Export / Import ──────────────────────────────────────

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): Project | null {
  try {
    const data = JSON.parse(json);
    if (!validateProjectData(data)) return null;

    // Explicit property picking to avoid prototype pollution
    const imported: Project = {
      id: nanoid(8),
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: new Date().toISOString(),
      workflow: data.workflow,
      snapshots: data.snapshots,
      settings: data.settings,
      _version: DATA_VERSION,
    };
    return imported;
  } catch {
    return null;
  }
}

// ── Validation ───────────────────────────────────────────

export function validateProjectData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  // Project name: required, non-empty, max length
  if (typeof d.name !== 'string' || d.name.trim().length === 0 || d.name.length > MAX_NAME_LENGTH) return false;
  if (typeof d.createdAt !== 'string') return false;

  // Workflow array
  if (!Array.isArray(d.workflow) || d.workflow.length === 0) return false;
  for (const state of d.workflow) {
    if (typeof state !== 'object' || state === null) return false;
    const s = state as Record<string, unknown>;
    if (typeof s.id !== 'string') return false;
    // State name: required, max length
    if (typeof s.name !== 'string' || s.name.trim().length === 0 || s.name.length > MAX_NAME_LENGTH) return false;
    if (typeof s.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.color)) return false;
    if (!['backlog', 'active', 'done'].includes(s.category as string)) return false;
    if (typeof s.order !== 'number') return false;
    // wipLimit: if present, must be a positive finite number
    if (s.wipLimit !== undefined && (typeof s.wipLimit !== 'number' || !Number.isFinite(s.wipLimit) || s.wipLimit <= 0)) return false;
  }

  // Snapshots array
  if (!Array.isArray(d.snapshots)) return false;
  for (const snap of d.snapshots) {
    if (typeof snap !== 'object' || snap === null) return false;
    const sn = snap as Record<string, unknown>;
    if (typeof sn.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sn.date)) return false;
    if (typeof sn.counts !== 'object' || sn.counts === null || Array.isArray(sn.counts)) return false;
    // Validate that all count values are finite numbers
    const counts = sn.counts as Record<string, unknown>;
    if (!Object.values(counts).every(v => typeof v === 'number' && Number.isFinite(v))) return false;
  }

  // Settings object
  if (typeof d.settings !== 'object' || d.settings === null) return false;
  const settings = d.settings as Record<string, unknown>;
  if (typeof settings.gridSortNewestFirst !== 'boolean') return false;
  if (typeof settings.showWipWarnings !== 'boolean') return false;
  if (typeof settings.metricsPeriod !== 'object' || settings.metricsPeriod === null) return false;
  const mp = settings.metricsPeriod as Record<string, unknown>;
  if (!['all', 'days', 'range'].includes(mp.kind as string)) return false;

  return true;
}

/**
 * Sanitize optional v0.7.0 cloud/fingerprinting fields on imported data.
 * Strips malformed optional fields rather than rejecting the entire document.
 * Call after validateProjectData() passes on the core fields.
 */
export function sanitizeCloudFields(data: Record<string, unknown>): void {
  // owner: must be a string if present
  if (data.owner !== undefined && typeof data.owner !== 'string') {
    delete data.owner;
  }

  // members: must be a valid role map if present
  if (data.members !== undefined) {
    if (typeof data.members !== 'object' || data.members === null || Array.isArray(data.members)) {
      delete data.members;
    } else {
      const members = data.members as Record<string, unknown>;
      for (const [uid, role] of Object.entries(members)) {
        if (typeof uid !== 'string' || !['owner', 'editor', 'viewer'].includes(role as string)) {
          delete data.members;
          break;
        }
      }
    }
  }

  // schemaVersion: must be a string if present
  if (data.schemaVersion !== undefined && typeof data.schemaVersion !== 'string') {
    delete data.schemaVersion;
  }

  // _originRef: must be a string if present
  if (data._originRef !== undefined && typeof data._originRef !== 'string') {
    delete data._originRef;
  }

  // _storageRef: must be a string if present
  if (data._storageRef !== undefined && typeof data._storageRef !== 'string') {
    delete data._storageRef;
  }

  // _changeLog: must be a valid array of ChangeLogEntry if present
  if (data._changeLog !== undefined) {
    if (!Array.isArray(data._changeLog)) {
      delete data._changeLog;
    } else {
      const validActions = ['created', 'imported', 'uploaded', 'shared', 'cloned'];
      const isValid = data._changeLog.every((entry: unknown) => {
        if (typeof entry !== 'object' || entry === null) return false;
        const e = entry as Record<string, unknown>;
        return (
          typeof e.action === 'string' && validActions.includes(e.action) &&
          typeof e.timestamp === 'string' &&
          typeof e.actor === 'string'
        );
      });
      if (!isValid) {
        delete data._changeLog;
      } else if (data._changeLog.length > 50) {
        // Cap at 50 entries
        data._changeLog = (data._changeLog as unknown[]).slice(-50);
      }
    }
  }
}
