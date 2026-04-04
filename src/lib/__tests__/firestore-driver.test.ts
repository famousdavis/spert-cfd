// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project } from '@/types';

// ── Firestore SDK mocks ─────────────────────────────────

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn((_db, _col, id) => ({ id, path: `${_col}/${id}` }));
const mockCollection = vi.fn((_db, col) => ({ id: col }));
const mockQuery = vi.fn((...args) => ({ _query: true, args }));
const mockWhere = vi.fn((...args) => ({ _where: true, args }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

// ── localStorage mock ────────────────────────────────────

let store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── Import after mocks ──────────────────────────────────

import { createFirestoreDriver } from '../firestore-driver';

// ── Helpers ─────────────────────────────────────────────

const TEST_UID = 'test-user-uid';
const FAKE_DB = {} as Parameters<typeof createFirestoreDriver>[1];

function sampleProject(overrides?: Partial<Project>): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 },
    ],
    snapshots: [],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  // Default: settings doc doesn't exist (no project order)
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
});

describe('FirestoreDriver', () => {
  describe('mode and workspaceId', () => {
    it('mode is "cloud"', () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      expect(driver.mode).toBe('cloud');
    });

    it('workspaceId is the uid', () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      expect(driver.workspaceId).toBe(TEST_UID);
    });
  });

  describe('createProject', () => {
    it('includes owner, members, schemaVersion, _originRef, _changeLog', async () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const project = sampleProject();

      await driver.createProject(project);

      expect(mockSetDoc).toHaveBeenCalled();
      const [, docData] = mockSetDoc.mock.calls[0];
      expect(docData.owner).toBe(TEST_UID);
      expect(docData.members).toEqual({ [TEST_UID]: 'owner' });
      expect(docData.schemaVersion).toBe('0.7.0');
      expect(docData._originRef).toBe(TEST_UID);
      expect(docData._changeLog).toBeDefined();
      expect(docData._changeLog.length).toBeGreaterThan(0);
      expect(docData._changeLog[0].action).toBe('created');
    });
  });

  describe('saveProject', () => {
    it('uses merge:true and does NOT include owner/members', async () => {
      vi.useFakeTimers();
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const project = sampleProject();

      const savePromise = driver.saveProject(project);
      vi.advanceTimersByTime(600); // past 500ms debounce
      await savePromise;

      expect(mockSetDoc).toHaveBeenCalled();
      const [, docData, options] = mockSetDoc.mock.calls[0];
      expect(options).toEqual({ merge: true });
      expect(docData.owner).toBeUndefined();
      expect(docData.members).toBeUndefined();
      expect(docData.schemaVersion).toBeUndefined();
      expect(docData.name).toBe('Test Project');

      vi.useRealTimers();
    });

    it('strips undefined values from payload', async () => {
      vi.useFakeTimers();
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const project = sampleProject();
      // wipLimit is undefined on the backlog state
      expect(project.workflow[0].wipLimit).toBeUndefined();

      const savePromise = driver.saveProject(project);
      vi.advanceTimersByTime(600);
      await savePromise;

      const [, docData] = mockSetDoc.mock.calls[0];
      // Check that the workflow state doesn't have an explicit undefined wipLimit
      const serialized = JSON.stringify(docData);
      expect(serialized).not.toContain('"wipLimit"');

      vi.useRealTimers();
    });
  });

  describe('deleteProject', () => {
    it('calls deleteDoc', async () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      await driver.deleteProject('proj-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('loadProjectList', () => {
    it('maps query results to {id, name}[]', async () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          cb({ id: 'p1', data: () => ({ name: 'Project 1' }) });
          cb({ id: 'p2', data: () => ({ name: 'Project 2' }) });
        },
      });

      const list = await driver.loadProjectList();
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({ id: 'p1', name: 'Project 1' });
      expect(list[1]).toEqual({ id: 'p2', name: 'Project 2' });
    });
  });

  describe('onProjectChange', () => {
    it('skips updates where hasPendingWrites is true', () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const callback = vi.fn();

      // Capture the onSnapshot callback
      mockOnSnapshot.mockImplementation((_ref, cb) => {
        // Simulate a snapshot with hasPendingWrites = true
        cb({
          exists: () => true,
          metadata: { hasPendingWrites: true },
          data: () => ({ name: 'Test' }),
          id: 'proj-1',
        });
        return () => {};
      });

      driver.onProjectChange('proj-1', callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('calls callback when hasPendingWrites is false', () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const callback = vi.fn();

      mockOnSnapshot.mockImplementation((_ref, cb) => {
        cb({
          exists: () => true,
          metadata: { hasPendingWrites: false },
          data: () => ({
            name: 'Test',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            workflow: [],
            snapshots: [],
            settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
          }),
          id: 'proj-1',
        });
        return () => {};
      });

      driver.onProjectChange('proj-1', callback);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportProject', () => {
    it('strips cloud fields and injects _storageRef', () => {
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const project = sampleProject({
        owner: TEST_UID,
        members: { [TEST_UID]: 'owner' },
        schemaVersion: '0.7.0',
        _originRef: TEST_UID,
        _changeLog: [{ action: 'created', timestamp: '2026-01-01T00:00:00.000Z', actor: TEST_UID }],
      });

      const json = driver.exportProject(project);
      const parsed = JSON.parse(json);

      expect(parsed.owner).toBeUndefined();
      expect(parsed.members).toBeUndefined();
      expect(parsed.schemaVersion).toBeUndefined();
      expect(parsed._originRef).toBeUndefined();
      expect(parsed._changeLog).toBeUndefined();
      expect(parsed._storageRef).toBe(TEST_UID);
      expect(parsed.name).toBe('Test Project');
    });
  });

  describe('flush', () => {
    it('fires pending debounced writes immediately', async () => {
      vi.useFakeTimers();
      const driver = createFirestoreDriver(TEST_UID, FAKE_DB);
      const project = sampleProject();

      // Start a debounced save but don't advance timers
      driver.saveProject(project);
      expect(mockSetDoc).not.toHaveBeenCalled();

      // Flush should write immediately
      driver.flush();
      expect(mockSetDoc).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
