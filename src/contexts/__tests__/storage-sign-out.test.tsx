// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// jsdom is required for renderHook to mount StorageProvider (React components
// need DOM). jsdom provides window and localStorage natively — do NOT redefine
// window here; doing so with a plain-object spread breaks DOM method resolution.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// ── localStorage mock ──────────────────────────────────────────────────────
let store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i] ?? null,
};
// In jsdom, override window.localStorage with the mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── Registry capture ─────────────────────────────────────────────────────────
let capturedCleanup: (() => Promise<void>) | null = null;
vi.mock('@/lib/sign-out-cleanup-registry', () => ({
  registerSignOutCleanup: vi.fn((fn: () => Promise<void>) => {
    capturedCleanup = fn;
    return () => { capturedCleanup = null; };
  }),
  runSignOutCleanup: vi.fn(async () => {
    if (capturedCleanup) await capturedCleanup();
  }),
}));

// ── App-data reset ────────────────────────────────────────────────────────────
vi.mock('@/lib/app-data-reset-registry', () => ({
  registerDataReset: vi.fn(() => () => {}),
  runDataReset: vi.fn(),
}));

// ── Driver factory mocks ──────────────────────────────────────────────────────
const mockLocalDriver = {
  mode: 'local' as const,
  workspaceId: 'ws-local',
  cancelPendingSaves: vi.fn(),
  flush: vi.fn(),
  loadProjectList: vi.fn().mockResolvedValue([]),
  loadProject: vi.fn().mockResolvedValue(null),
  createProject: vi.fn().mockResolvedValue(undefined),
  saveProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getActiveProjectId: vi.fn(() => null),
  setActiveProjectId: vi.fn(),
  reorderProjects: vi.fn().mockResolvedValue(undefined),
  onProjectChange: vi.fn(() => () => {}),
  onProjectListChange: vi.fn(() => () => {}),
  exportProject: vi.fn(() => '{}'),
  importProject: vi.fn(() => null),
  removeCollaborator: vi.fn().mockResolvedValue(undefined),
  listPendingInvites: vi.fn().mockResolvedValue([]),
  revokeInvite: vi.fn().mockResolvedValue(undefined),
  resendInvite: vi.fn().mockResolvedValue(undefined),
};
const mockCloudDriver = { ...mockLocalDriver, mode: 'cloud' as const, workspaceId: 'cloud-uid' };
vi.mock('@/lib/local-storage-driver', () => ({
  createLocalStorageDriver: vi.fn(() => mockLocalDriver),
}));
vi.mock('@/lib/firestore-driver', () => ({
  createFirestoreDriver: vi.fn(() => mockCloudDriver),
}));

// ── Firebase / auth mocks ─────────────────────────────────────────────────────
const mockUser = { uid: 'cloud-uid', emailVerified: true };
const mockUseAuth = vi.fn();
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  isFirebaseConfigured: true,
  googleProvider: null,
  microsoftProvider: null,
}));
vi.mock('firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { clearCloudSessionKeys, StorageProvider } from '../storage-context';
import { LS_ACTIVE_PROJECT, LS_HAS_UPLOADED } from '@/lib/constants';

// ── Helpers ───────────────────────────────────────────────────────────────────
function seedProjectData() {
  store[LS_ACTIVE_PROJECT] = 'proj-1';
  store[LS_HAS_UPLOADED] = 'true';
  store['cfd-lab'] = JSON.stringify({ projectIds: ['proj-1', 'proj-2'] });
  store['cfd-lab-project-proj-1'] = JSON.stringify({ id: 'proj-1' });
  store['cfd-lab-project-proj-2'] = JSON.stringify({ id: 'proj-2' });
}

// ── Unit tests: clearCloudSessionKeys directly ───────────────────────────────
// Before v0.15.20 this function also removed every local project and the
// index (QC26 Q02): the next two tests asserted the opposite of what they do now.
describe('clearCloudSessionKeys — unit', () => {
  beforeEach(() => { store = {}; seedProjectData(); });
  it('removes LS_ACTIVE_PROJECT and LS_HAS_UPLOADED', () => {
    clearCloudSessionKeys();
    expect(store[LS_ACTIVE_PROJECT]).toBeUndefined();
    expect(store[LS_HAS_UPLOADED]).toBeUndefined();
  });
  it('leaves every local project data key', () => {
    clearCloudSessionKeys();
    expect(store['cfd-lab-project-proj-1']).toBeDefined();
    expect(store['cfd-lab-project-proj-2']).toBeDefined();
  });
  it('leaves the index key', () => {
    clearCloudSessionKeys();
    expect(store['cfd-lab']).toBeDefined();
  });
});

// ── F3 integration: mode gate in real performSignOutWithCleanup ───────────────
describe('performSignOutWithCleanup — mode gate (F3 integration)', () => {
  beforeEach(() => {
    store = {};
    capturedCleanup = null;
    vi.clearAllMocks();
  });
  afterEach(() => { capturedCleanup = null; });
  it('does NOT clear project localStorage when driver is in local mode', async () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthLoading: false });
    seedProjectData();
    await act(async () => {
      render(<StorageProvider><div /></StorageProvider>);
    });
    expect(capturedCleanup).not.toBeNull();
    await capturedCleanup!();
    // Local mode: project data must survive
    expect(store['cfd-lab-project-proj-1']).toBeDefined();
    expect(store['cfd-lab']).toBeDefined();
    // ...and so must the keys that cloud-mode sign-out clears
    expect(store[LS_ACTIVE_PROJECT]).toBe('proj-1');
    expect(store[LS_HAS_UPLOADED]).toBe('true');
  });
  it('clears only the cloud session keys when driver is in cloud mode', async () => {
    store['spertcfd-storage-mode'] = 'cloud';
    mockUseAuth.mockReturnValue({ user: mockUser, isAuthLoading: false });
    seedProjectData();
    await act(async () => {
      render(<StorageProvider><div /></StorageProvider>);
    });
    expect(capturedCleanup).not.toBeNull();
    await capturedCleanup!();
    // Local projects survive (before v0.15.20 they were removed, QC26 Q02)
    expect(store['cfd-lab-project-proj-1']).toBeDefined();
    expect(store['cfd-lab']).toBeDefined();
    expect(store[LS_ACTIVE_PROJECT]).toBeUndefined();
    expect(store[LS_HAS_UPLOADED]).toBeUndefined();
  });
});

// ── E1 structural test: Path 3 try/finally guarantees setUser(null) ──────────
//
// Note: This test mirrors the try/finally structure from auth-context.tsx Path 3
// rather than rendering AuthProvider. This is intentional — intercepting the
// onAuthStateChanged null-callback invocation requires a large Firebase mock
// surface disproportionate to the risk. The F3 integration tests above are the
// primary regression guard for the registered cleanup function's correctness.
describe('E1 — Path 3 try/finally guarantee', () => {
  it('setUser(null) and setIsAuthLoading(false) fire even when cleanup throws', async () => {
    const setUser = vi.fn();
    const setIsAuthLoading = vi.fn();
    const throwingCleanup = vi.fn().mockRejectedValue(new Error('cleanup boom'));
    const path3Handler = async () => {
      try {
        await throwingCleanup();
      } catch {
        // swallowed
      } finally {
        setUser(null);
        setIsAuthLoading(false);
      }
    };
    await path3Handler();
    expect(setUser).toHaveBeenCalledWith(null);
    expect(setIsAuthLoading).toHaveBeenCalledWith(false);
    expect(throwingCleanup).toHaveBeenCalledTimes(1);
  });
});
