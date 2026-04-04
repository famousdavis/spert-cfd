// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project } from '@/types';
import type { StorageDriver, ProjectListItem } from '../storage-driver';

// ── Firestore SDK mocks ─────────────────────────────────

const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_db, _col, id) => ({ id, path: `${_col}/${id}` }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

// ── Import after mocks ──────────────────────────────────

import { migrateLocalToCloud, clearLocalProjects } from '../cloud-migration';

// ── Helpers ─────────────────────────────────────────────

const TEST_UID = 'test-user-uid';
const FAKE_DB = {} as Parameters<typeof migrateLocalToCloud>[1];

function sampleProject(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
    ],
    snapshots: [],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

function createMockDriver(projects: Project[]): StorageDriver {
  const store = new Map(projects.map((p) => [p.id, p]));
  const deletedIds: string[] = [];

  return {
    mode: 'local',
    workspaceId: 'test-workspace',
    loadProjectList: async () =>
      [...store.values()].map((p): ProjectListItem => ({ id: p.id, name: p.name })),
    loadProject: async (id) => store.get(id) ?? null,
    createProject: async (p) => { store.set(p.id, p); },
    saveProject: async (p) => { store.set(p.id, p); },
    deleteProject: async (id) => { store.delete(id); deletedIds.push(id); },
    getActiveProjectId: () => null,
    setActiveProjectId: () => {},
    reorderProjects: async () => {},
    onProjectChange: () => () => {},
    onProjectListChange: () => () => {},
    exportProject: (p) => JSON.stringify(p),
    importProject: () => null,
    flush: () => {},
  };
}

// ── Tests ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('migrateLocalToCloud', () => {
  it('uploads all local projects with correct ownership', async () => {
    const p1 = sampleProject('p1', 'Project 1');
    const localDriver = createMockDriver([p1]);
    const cloudDriver = createMockDriver([]);

    // No collision — doc doesn't exist
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });

    const result = await migrateLocalToCloud(TEST_UID, FAKE_DB, localDriver, cloudDriver);

    expect(result.uploaded).toBe(1);
    expect(result.skipped).toBe(0);

    // Verify the project was created in cloud driver
    const cloudList = await cloudDriver.loadProjectList();
    expect(cloudList).toHaveLength(1);
  });

  it('skips projects that already exist in cloud (user is member)', async () => {
    const p1 = sampleProject('p1', 'Project 1');
    const localDriver = createMockDriver([p1]);
    const cloudDriver = createMockDriver([]);

    // Doc exists and user is a member
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ members: { [TEST_UID]: 'owner' } }),
    });

    const result = await migrateLocalToCloud(TEST_UID, FAKE_DB, localDriver, cloudDriver);

    expect(result.uploaded).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('generates new ID when collision detected (PERMISSION_DENIED)', async () => {
    const p1 = sampleProject('p1', 'Project 1');
    const localDriver = createMockDriver([p1]);
    const cloudDriver = createMockDriver([]);

    // PERMISSION_DENIED — doc exists but user isn't a member
    mockGetDoc.mockRejectedValue({ code: 'permission-denied' });

    const result = await migrateLocalToCloud(TEST_UID, FAKE_DB, localDriver, cloudDriver);

    expect(result.uploaded).toBe(1);

    // The project should have a new ID (not 'p1')
    const cloudList = await cloudDriver.loadProjectList();
    expect(cloudList).toHaveLength(1);
    expect(cloudList[0].id).not.toBe('p1');
  });

  it('returns correct counts for mixed scenarios', async () => {
    const p1 = sampleProject('p1', 'Project 1');
    const p2 = sampleProject('p2', 'Project 2');
    const p3 = sampleProject('p3', 'Project 3');
    const localDriver = createMockDriver([p1, p2, p3]);
    const cloudDriver = createMockDriver([]);

    // p1: no collision, p2: already exists (skip), p3: PERMISSION_DENIED (new ID)
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null }) // p1
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ members: { [TEST_UID]: 'owner' } }) }) // p2
      .mockRejectedValueOnce({ code: 'permission-denied' }); // p3

    const result = await migrateLocalToCloud(TEST_UID, FAKE_DB, localDriver, cloudDriver);

    expect(result.uploaded).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it('adds _changeLog entry with action "uploaded"', async () => {
    const p1 = sampleProject('p1', 'Project 1');
    const localDriver = createMockDriver([p1]);
    const cloudDriver = createMockDriver([]);

    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });

    await migrateLocalToCloud(TEST_UID, FAKE_DB, localDriver, cloudDriver);

    // Check the uploaded project's changelog
    const cloudList = await cloudDriver.loadProjectList();
    const uploaded = await cloudDriver.loadProject(cloudList[0].id);
    expect(uploaded!._changeLog).toBeDefined();
    expect(uploaded!._changeLog!.some((e) => e.action === 'uploaded')).toBe(true);
  });
});

describe('clearLocalProjects', () => {
  it('deletes all local projects', async () => {
    const p1 = sampleProject('p1', 'Project 1');
    const p2 = sampleProject('p2', 'Project 2');
    const localDriver = createMockDriver([p1, p2]);

    await clearLocalProjects(localDriver);

    const list = await localDriver.loadProjectList();
    expect(list).toHaveLength(0);
  });
});
