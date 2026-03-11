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

  it('adds project ID to index on save', () => {
    const project = createSampleProject();
    saveProject(project);

    const index = loadIndex();
    expect(index.projectIds).toContain(project.id);
  });

  it('does not duplicate project ID on repeated saves', () => {
    const project = createSampleProject();
    saveProject(project);
    saveProject(project);

    const index = loadIndex();
    const count = index.projectIds.filter((id) => id === project.id).length;
    expect(count).toBe(1);
  });

  it('deletes a project and removes from index', () => {
    const project = createSampleProject();
    saveProject(project);
    deleteProject(project.id);

    expect(loadProject(project.id)).toBeNull();
    expect(loadIndex().projectIds).not.toContain(project.id);
  });

  it('resets activeProjectId when active project is deleted', () => {
    const p1 = createSampleProject();
    const p2 = createSampleProject();
    saveProject(p1);
    saveProject(p2);

    const index = loadIndex();
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
});
