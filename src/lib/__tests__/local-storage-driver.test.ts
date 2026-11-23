// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  // v0.20.2 (DASH26 R2o, O53a): a drop is a move made within the index as it
  // is read now. Each "another tab" case runs a second driver on the same
  // localStorage, as a second tab of this browser does. At 3463be9 the tab's
  // whole list was written, and refused silently unless it was exactly the
  // index: the unreadable-id, added and deleted cases did nothing, and the
  // reordered case undid the other tab's order (measured, R2 pre-flight).
  describe('moveProject', () => {
    const p = (id: string) => ({ ...createSampleProject(), id, name: id.toUpperCase() });
    const index = () => JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}').projectIds as string[];
    const held = async () => (await driver.loadProjectList()).map((x) => x.id);
    const move = (draggedId: string, targetId: string, heldIds: string[], shownIds = heldIds) =>
      driver.moveProject({ draggedId, targetId, shownIds, heldIds });
    async function seed(...ids: string[]) {
      for (const id of ids) await driver.createProject(p(id));
    }

    it('writes the move (control: every id readable)', async () => {
      await seed('a', 'b', 'c');
      expect(await move('c', 'a', await held())).toEqual({ kind: 'written', order: ['c', 'a', 'b'] });
      expect(index()).toEqual(['c', 'a', 'b']);
      expect(await held()).toEqual(['c', 'a', 'b']);
    });

    it('an id this browser cannot read keeps its slot, and the drop is written', async () => {
      await seed('a', 'b', 'c');
      localStorage.setItem('cfd-lab-project-b', '{not json');
      const tab = await held();
      expect(tab).toEqual(['a', 'c']);
      expect(await move('c', 'a', tab)).toEqual({ kind: 'written', order: ['c', 'b', 'a'] });
      expect(index()).toEqual(['c', 'b', 'a']);
    });

    it('a project another tab added keeps its slot, and the drop is written', async () => {
      await seed('a', 'b');
      const tab = await held();
      await createLocalStorageDriver().createProject(p('n'));
      expect(await move('b', 'a', tab)).toEqual({ kind: 'written', order: ['b', 'a', 'n'] });
    });

    it("another tab's reorder is kept: the drop is applied to it", async () => {
      await seed('a', 'b', 'c');
      const tab = await held();
      const other = createLocalStorageDriver();
      await other.moveProject({ draggedId: 'c', targetId: 'a', shownIds: tab, heldIds: tab }); // c a b
      await other.moveProject({ draggedId: 'b', targetId: 'a', shownIds: tab, heldIds: tab }); // c b a
      expect(index()).toEqual(['c', 'b', 'a']);
      expect(await move('a', 'b', tab)).toEqual({ kind: 'written', order: ['c', 'a', 'b'] });
    });

    it('a project another tab deleted never comes back, and a drop naming it is refused', async () => {
      await seed('a', 'b', 'c');
      const tab = await held();
      await createLocalStorageDriver().deleteProject('b');
      expect(await move('c', 'a', tab)).toEqual({ kind: 'written', order: ['c', 'a'] });
      expect(index()).toEqual(['c', 'a']);
      expect(await move('b', 'a', tab)).toEqual({ kind: 'refused' });
      expect(await move('a', 'b', tab)).toEqual({ kind: 'refused' });
      expect(index()).toEqual(['c', 'a']);
    });

    it('ids not shown keep their slots', async () => {
      await seed('a', 'x', 'b', 'c');
      expect(await move('c', 'a', await held(), ['a', 'b', 'c'])).toEqual({ kind: 'written', order: ['c', 'x', 'a', 'b'] });
    });

    it('a move that changes nothing writes nothing', async () => {
      await seed('a', 'b');
      const before = localStorage.getItem(INDEX_KEY);
      expect(await move('a', 'a', await held())).toEqual({ kind: 'unchanged' });
      expect(await move('a', 'b', await held(), ['a'])).toEqual({ kind: 'unchanged' });
      expect(localStorage.getItem(INDEX_KEY)).toBe(before);
    });

    it('an index write that throws is reported as failed, and the index is unchanged', async () => {
      await seed('a', 'b');
      const tab = await held();
      const setItem = localStorage.setItem.bind(localStorage);
      const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (key === INDEX_KEY) throw new DOMException('full', 'QuotaExceededError');
        return setItem(key, value);
      });
      try {
        expect(await move('b', 'a', tab)).toEqual({ kind: 'failed' });
      } finally {
        spy.mockRestore();
      }
      expect(index()).toEqual(['a', 'b']);
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

  describe('cancelPendingSaves', () => {
    it('is a no-op that does not throw', () => {
      expect(() => driver.cancelPendingSaves()).not.toThrow();
    });
  });

  describe('invitation stubs (cloud-only feature)', () => {
    it('listPendingInvites resolves to an empty array', async () => {
      await expect(driver.listPendingInvites('any-project-id'))
        .resolves.toEqual([]);
    });

    it('revokeInvite is a silent no-op (resolves without throwing)', async () => {
      await expect(driver.revokeInvite('any-token-id')).resolves.toBeUndefined();
    });

    it('resendInvite is a silent no-op (resolves without throwing)', async () => {
      await expect(driver.resendInvite('any-token-id')).resolves.toBeUndefined();
    });

    it('removeCollaborator is a silent no-op (resolves without throwing)', async () => {
      await expect(driver.removeCollaborator('any-project-id', 'any-uid'))
        .resolves.toBeUndefined();
    });
  });
});

// v0.19.0 (DASH26 O22 e, R1b F7): the positioned create (Clone), and a create
// whose index write is refused.
describe('LocalStorageDriver createProject, v0.19.0', () => {
  const sample = (id: string, name = id) => ({ ...createSampleProject(), id, name });
  const ids = () => JSON.parse(store[INDEX_KEY]).projectIds as string[];

  it('with a placement, the id goes right after its source in the STORED index; an unreadable id stays where it is', async () => {
    const driver = createLocalStorageDriver();
    for (const id of ['a', 'b']) await driver.createProject(sample(id));
    store[INDEX_KEY] = JSON.stringify({ ...JSON.parse(store[INDEX_KEY]), projectIds: ['a', 'unread', 'b'] });
    await driver.createProject(sample('c'), { after: 'a', shownIds: ['a', 'b'] });
    expect(ids()).toEqual(['a', 'c', 'unread', 'b']);
  });

  it('with a placement whose source is not stored, the id is appended', async () => {
    const driver = createLocalStorageDriver();
    await driver.createProject(sample('a'));
    await driver.createProject(sample('c'), { after: 'gone', shownIds: [] });
    expect(ids()).toEqual(['a', 'c']);
  });

  it('F7: an index write refused (storage full) removes the project data it just wrote, and throws', () => {
    const driver = createLocalStorageDriver();
    void driver.createProject(sample('a'));
    const setItem = localStorageMock.setItem;
    localStorageMock.setItem = (key: string, value: string) => {
      if (key === INDEX_KEY) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      setItem(key, value);
    };
    try {
      expect(() => driver.createProject(sample('b'))).toThrow('The quota has been exceeded.');
    } finally {
      localStorageMock.setItem = setItem;
    }
    expect(store['cfd-lab-project-b']).toBeUndefined();
    expect(store['cfd-lab-project-a']).toBeDefined();
    expect(ids()).toEqual(['a']);
  });
});
