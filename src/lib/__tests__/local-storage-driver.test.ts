// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalStorageDriver } from '../local-storage-driver';
import { createSampleProject } from '../sample-data';
import { INDEX_KEY } from '../storage';
import { LS_ACTIVE_PROJECT, LS_WORKSPACE_ID } from '../constants';
import { DATA_VERSION } from '../migrations';
import type { StorageDriver } from '../storage-driver';

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

describe('LocalStorageDriver', () => {
  let driver: StorageDriver;

  beforeEach(() => {
    driver = createLocalStorageDriver();
  });

  describe('mode and workspaceId', () => {
    it('mode is "local"', () => {
      expect(driver.mode).toBe('local');
    });

    it('workspaceId is a non-empty string', () => {
      expect(driver.workspaceId).toBeTruthy();
      expect(typeof driver.workspaceId).toBe('string');
    });

    it('workspaceId is stable across calls', () => {
      const first = driver.workspaceId;
      const second = driver.workspaceId;
      expect(first).toBe(second);
    });

    it('workspaceId persists in localStorage', () => {
      const id = driver.workspaceId;
      expect(localStorage.getItem(LS_WORKSPACE_ID)).toBe(id);
    });
  });

  describe('loadProjectList', () => {
    it('returns empty array initially', async () => {
      const list = await driver.loadProjectList();
      expect(list).toEqual([]);
    });

    it('returns projects after createProject', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);

      const list = await driver.loadProjectList();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(sample.id);
      expect(list[0].name).toBe(sample.name);
    });
  });

  describe('createProject', () => {
    it('makes project available via loadProject', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);

      const loaded = await driver.loadProject(sample.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe(sample.name);
    });

    it('adds project ID to the index', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);

      const raw = localStorage.getItem(INDEX_KEY);
      const index = JSON.parse(raw!);
      expect(index.projectIds).toContain(sample.id);
    });

    it('does not duplicate project ID on repeated creates', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);
      await driver.createProject(sample);

      const raw = localStorage.getItem(INDEX_KEY);
      const index = JSON.parse(raw!);
      const count = index.projectIds.filter((id: string) => id === sample.id).length;
      expect(count).toBe(1);
    });
  });

  describe('saveProject', () => {
    it('updates project data', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);

      const loaded = (await driver.loadProject(sample.id))!;
      loaded.name = 'Renamed';
      await driver.saveProject(loaded);

      const reloaded = await driver.loadProject(sample.id);
      expect(reloaded!.name).toBe('Renamed');
    });

    it('does not modify the index', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);

      const indexBefore = JSON.parse(localStorage.getItem(INDEX_KEY)!);
      await driver.saveProject({ ...sample, name: 'Updated' });
      const indexAfter = JSON.parse(localStorage.getItem(INDEX_KEY)!);

      expect(indexAfter.projectIds).toEqual(indexBefore.projectIds);
    });
  });

  describe('deleteProject', () => {
    it('removes project from storage and list', async () => {
      const sample = createSampleProject();
      await driver.createProject(sample);
      await driver.deleteProject(sample.id);

      expect(await driver.loadProject(sample.id)).toBeNull();
      const list = await driver.loadProjectList();
      expect(list).toHaveLength(0);
    });
  });

  describe('activeProjectId', () => {
    it('returns null initially', () => {
      expect(driver.getActiveProjectId()).toBeNull();
    });

    it('persists and retrieves correctly', () => {
      driver.setActiveProjectId('test-id');
      expect(driver.getActiveProjectId()).toBe('test-id');
    });

    it('clears when set to null', () => {
      driver.setActiveProjectId('test-id');
      driver.setActiveProjectId(null);
      expect(driver.getActiveProjectId()).toBeNull();
    });

    it('migrates from old StorageIndex on first call', () => {
      // Seed the old index with an activeProjectId
      const oldIndex = {
        version: DATA_VERSION,
        activeProjectId: 'legacy-id',
        projectIds: ['legacy-id'],
      };
      localStorage.setItem(INDEX_KEY, JSON.stringify(oldIndex));

      // Fresh driver should migrate
      const freshDriver = createLocalStorageDriver();
      expect(freshDriver.getActiveProjectId()).toBe('legacy-id');

      // Verify it was written to the new key
      expect(localStorage.getItem(LS_ACTIVE_PROJECT)).toBe('legacy-id');
    });

    it('does not re-read old index after migration', () => {
      const oldIndex = {
        version: DATA_VERSION,
        activeProjectId: 'legacy-id',
        projectIds: ['legacy-id'],
      };
      localStorage.setItem(INDEX_KEY, JSON.stringify(oldIndex));

      const freshDriver = createLocalStorageDriver();
      freshDriver.getActiveProjectId(); // triggers migration

      // Change the old index — should have no effect
      const updatedIndex = { ...oldIndex, activeProjectId: 'changed-id' };
      localStorage.setItem(INDEX_KEY, JSON.stringify(updatedIndex));

      expect(freshDriver.getActiveProjectId()).toBe('legacy-id');
    });
  });

  describe('reorderProjects', () => {
    it('persists new order', async () => {
      const p1 = createSampleProject();
      const p2 = createSampleProject();
      await driver.createProject(p1);
      await driver.createProject(p2);

      await driver.reorderProjects([p2.id, p1.id]);

      const list = await driver.loadProjectList();
      expect(list[0].id).toBe(p2.id);
      expect(list[1].id).toBe(p1.id);
    });

    it('rejects invalid permutations silently', async () => {
      const p1 = createSampleProject();
      await driver.createProject(p1);

      // Wrong length
      await driver.reorderProjects([p1.id, 'nonexistent']);
      const list = await driver.loadProjectList();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(p1.id);
    });
  });

  describe('export and import', () => {
    it('exportProject returns valid JSON', () => {
      const sample = createSampleProject();
      const json = driver.exportProject(sample);
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe(sample.name);
    });

    it('exportProject injects _storageRef with workspaceId', () => {
      const sample = createSampleProject();
      const json = driver.exportProject(sample);
      const parsed = JSON.parse(json);
      expect(parsed._storageRef).toBe(driver.workspaceId);
      expect(parsed._storageRef).toBeTruthy();
    });

    it('importProject returns project with new ID', () => {
      const sample = createSampleProject();
      const json = driver.exportProject(sample);
      const imported = driver.importProject(json);

      expect(imported).not.toBeNull();
      expect(imported!.id).not.toBe(sample.id);
      expect(imported!.name).toBe(sample.name);
    });

    it('importProject rejects invalid JSON', () => {
      expect(driver.importProject('{{bad')).toBeNull();
    });
  });

  describe('real-time sync (no-op)', () => {
    it('onProjectChange returns a function', () => {
      const unsub = driver.onProjectChange('any-id', () => {});
      expect(typeof unsub).toBe('function');
      unsub(); // should not throw
    });

    it('onProjectListChange returns a function', () => {
      const unsub = driver.onProjectListChange(() => {});
      expect(typeof unsub).toBe('function');
      unsub(); // should not throw
    });
  });

  describe('flush', () => {
    it('can be called without error', () => {
      expect(() => driver.flush()).not.toThrow();
    });
  });
});
