// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadIndex,
  saveIndex,
  loadProject,
  saveProject,
  deleteProject,
  exportProject,
  importProject,
  validateProjectData,
  sanitizeCloudFields,
  INDEX_KEY,
} from '../storage';
import { DATA_VERSION } from '../migrations';
import { createSampleProject } from '../sample-data';

// ── localStorage mock ────────────────────────────────────

let store: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  store = {};
});

// ── Tests ────────────────────────────────────────────────

describe('Storage Index', () => {
  it('returns default index when nothing stored', () => {
    const index = loadIndex();
    expect(index).toEqual({
      version: DATA_VERSION,
      activeProjectId: null,
      projectIds: [],
    });
  });

  it('round-trips index through save/load', () => {
    const index = { version: DATA_VERSION, activeProjectId: 'abc', projectIds: ['abc'] };
    saveIndex(index);
    expect(loadIndex()).toEqual(index);
  });

  it('returns default on corrupted JSON', () => {
    store[INDEX_KEY] = '{{bad json';
    expect(loadIndex()).toEqual({
      version: DATA_VERSION,
      activeProjectId: null,
      projectIds: [],
    });
  });
});

describe('Project CRUD', () => {
  it('saves and loads a project', () => {
    const project = createSampleProject();
    saveProject(project);

    const loaded = loadProject(project.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Sample: 2-Week Sprint');
    expect(loaded!.workflow).toHaveLength(5);
    expect(loaded!.snapshots).toHaveLength(14);
  });

  it('saveProject does not modify the index', () => {
    const project = createSampleProject();
    const indexBefore = loadIndex();
    saveProject(project);
    const indexAfter = loadIndex();

    expect(indexAfter.projectIds).toEqual(indexBefore.projectIds);
  });

  it('deletes a project and removes from index', () => {
    const project = createSampleProject();
    saveProject(project);
    // Manually add to index (saveProject no longer does this)
    const idx = loadIndex();
    idx.projectIds.push(project.id);
    saveIndex(idx);

    deleteProject(project.id);

    expect(loadProject(project.id)).toBeNull();
    expect(loadIndex().projectIds).not.toContain(project.id);
  });

  it('resets activeProjectId when active project is deleted', () => {
    const p1 = createSampleProject();
    const p2 = createSampleProject();
    saveProject(p1);
    saveProject(p2);

    // Manually register both in index (saveProject no longer does this)
    const index = loadIndex();
    index.projectIds.push(p1.id, p2.id);
    index.activeProjectId = p1.id;
    saveIndex(index);

    deleteProject(p1.id);
    expect(loadIndex().activeProjectId).toBe(p2.id);
  });

  it('returns null for non-existent project', () => {
    expect(loadProject('nonexistent')).toBeNull();
  });
});

describe('Edit-Save-Reload cycle', () => {
  it('persists edits across save/load', () => {
    const project = createSampleProject();
    saveProject(project);

    const loaded = loadProject(project.id)!;
    loaded.name = 'Renamed Sprint';
    loaded.snapshots.push({
      date: '2024-01-19',
      counts: { backlog: 0, analysis: 0, dev: 0, review: 0, done: 24 },
    });
    saveProject(loaded);

    const reloaded = loadProject(project.id)!;
    expect(reloaded.name).toBe('Renamed Sprint');
    expect(reloaded.snapshots).toHaveLength(15);
    expect(reloaded.snapshots[14].counts.done).toBe(24);
  });
});

describe('Export / Import', () => {
  it('exports a project as valid JSON', () => {
    const project = createSampleProject();
    const json = exportProject(project);
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe('Sample: 2-Week Sprint');
    expect(parsed.workflow).toHaveLength(5);
  });

  it('imports a project with a new ID', () => {
    const project = createSampleProject();
    const json = exportProject(project);
    const imported = importProject(json);

    expect(imported).not.toBeNull();
    expect(imported!.id).not.toBe(project.id);
    expect(imported!.name).toBe('Sample: 2-Week Sprint');
    expect(imported!.workflow).toHaveLength(5);
  });

  it('rejects invalid JSON on import', () => {
    expect(importProject('{{bad')).toBeNull();
  });

  it('rejects object missing required fields', () => {
    expect(importProject(JSON.stringify({ name: 'Test' }))).toBeNull();
  });

  it('round-trips through export/import without data loss', () => {
    const original = createSampleProject();
    const json = exportProject(original);
    const imported = importProject(json)!;

    expect(imported.workflow).toHaveLength(original.workflow.length);
    expect(imported.snapshots).toHaveLength(original.snapshots.length);
    expect(imported.settings).toEqual(original.settings);

    // Verify snapshot data integrity
    for (let i = 0; i < original.snapshots.length; i++) {
      expect(imported.snapshots[i].date).toBe(original.snapshots[i].date);
      expect(imported.snapshots[i].counts).toEqual(original.snapshots[i].counts);
    }
  });
});

describe('validateProjectData', () => {
  it('validates a correct project', () => {
    const project = createSampleProject();
    expect(validateProjectData(project)).toBe(true);
  });

  it('rejects non-object', () => {
    expect(validateProjectData(null)).toBe(false);
    expect(validateProjectData('string')).toBe(false);
    expect(validateProjectData(42)).toBe(false);
  });

  it('rejects empty workflow', () => {
    const project = createSampleProject();
    (project as unknown as Record<string, unknown>).workflow = [];
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects missing name', () => {
    const project = createSampleProject();
    (project as unknown as Record<string, unknown>).name = '';
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects invalid workflow state category', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).category = 'invalid';
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects empty workflow state name', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).name = '';
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects whitespace-only workflow state name', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).name = '   ';
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects invalid hex color in workflow state', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).color = 'red';
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects short hex color (3-digit)', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).color = '#abc';
    expect(validateProjectData(project)).toBe(false);
  });

  it('rejects hex color without hash prefix', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).color = '3b82f6';
    expect(validateProjectData(project)).toBe(false);
  });

  it('accepts valid 6-digit hex color', () => {
    const project = createSampleProject();
    (project.workflow[0] as unknown as Record<string, unknown>).color = '#3b82f6';
    expect(validateProjectData(project)).toBe(true);
  });
});

describe('sanitizeCloudFields', () => {
  it('strips malformed owner (non-string)', () => {
    const data: Record<string, unknown> = { owner: 123 };
    sanitizeCloudFields(data);
    expect(data.owner).toBeUndefined();
  });

  it('preserves valid owner (string)', () => {
    const data: Record<string, unknown> = { owner: 'uid-123' };
    sanitizeCloudFields(data);
    expect(data.owner).toBe('uid-123');
  });

  it('strips malformed members (array instead of object)', () => {
    const data: Record<string, unknown> = { members: ['uid1', 'uid2'] };
    sanitizeCloudFields(data);
    expect(data.members).toBeUndefined();
  });

  it('strips members with invalid roles', () => {
    const data: Record<string, unknown> = { members: { uid1: 'admin' } };
    sanitizeCloudFields(data);
    expect(data.members).toBeUndefined();
  });

  it('preserves valid members map', () => {
    const data: Record<string, unknown> = { members: { uid1: 'owner', uid2: 'editor' } };
    sanitizeCloudFields(data);
    expect(data.members).toEqual({ uid1: 'owner', uid2: 'editor' });
  });

  it('strips malformed _changeLog (non-array)', () => {
    const data: Record<string, unknown> = { _changeLog: 'not-an-array' };
    sanitizeCloudFields(data);
    expect(data._changeLog).toBeUndefined();
  });

  it('strips _changeLog with invalid entries', () => {
    const data: Record<string, unknown> = { _changeLog: [{ action: 'hacked', timestamp: '2026-01-01', actor: 'x' }] };
    sanitizeCloudFields(data);
    expect(data._changeLog).toBeUndefined();
  });

  it('preserves valid _changeLog', () => {
    const log = [{ action: 'created', timestamp: '2026-01-01T00:00:00Z', actor: 'uid-1' }];
    const data: Record<string, unknown> = { _changeLog: log };
    sanitizeCloudFields(data);
    expect(data._changeLog).toEqual(log);
  });

  it('caps _changeLog at 50 entries', () => {
    const log = Array.from({ length: 60 }, (_, i) => ({
      action: 'created' as const, timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, actor: 'uid',
    }));
    const data: Record<string, unknown> = { _changeLog: log };
    sanitizeCloudFields(data);
    expect((data._changeLog as unknown[]).length).toBe(50);
  });

  it('strips malformed _originRef (non-string)', () => {
    const data: Record<string, unknown> = { _originRef: 42 };
    sanitizeCloudFields(data);
    expect(data._originRef).toBeUndefined();
  });

  it('does not touch fields that are absent', () => {
    const data: Record<string, unknown> = { name: 'Test' };
    sanitizeCloudFields(data);
    expect(data).toEqual({ name: 'Test' });
  });
});
