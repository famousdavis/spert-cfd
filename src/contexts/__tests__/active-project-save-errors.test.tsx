// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { WorkflowState, ProjectSettings } from '@/types';

// ── Sample project ─────────────────────────────────────────────────────────────
const sampleProject = {
  id: 'proj-1',
  name: 'Test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [
    { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog' as const, order: 0 },
  ],
  snapshots: [],
  settings: {
    gridSortNewestFirst: true,
    showWipWarnings: true,
    metricsPeriod: { kind: 'all' as const },
  },
  _version: '0.13.1',
};

// ── Rejecting mock driver ──────────────────────────────────────────────────────
const mockSaveProject = vi.fn().mockRejectedValue(
  Object.assign(new Error('storage error'), { code: 'permission-denied' }),
);
const mockDriver = {
  mode: 'local' as const,
  workspaceId: 'ws-test',
  flush: vi.fn(),
  cancelPendingSaves: vi.fn(),
  loadProjectList: vi.fn().mockResolvedValue([]),
  loadProject: vi.fn().mockResolvedValue(sampleProject),
  createProject: vi.fn().mockResolvedValue(undefined),
  saveProject: mockSaveProject,
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getActiveProjectId: vi.fn(() => 'proj-1'),
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

// ── Context mocks ──────────────────────────────────────────────────────────────
vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: vi.fn(() => ({ activeProjectId: 'proj-1', projectUpdateKey: 0 })),
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: vi.fn(() => ({ driver: mockDriver, mode: 'local' })),
}));
vi.mock('@/lib/app-data-reset-registry', () => ({
  registerDataReset: vi.fn(() => () => {}),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

// ── Setup ──────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockSaveProject.mockRejectedValue(
    Object.assign(new Error('storage error'), { code: 'permission-denied' }),
  );
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  <ActiveProjectProvider>{children}</ActiveProjectProvider>;

async function mountAndWaitForProject() {
  const result = renderHook(() => useActiveProject(), { wrapper });
  await act(async () => { await Promise.resolve(); });
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('ActiveProjectProvider — L1 .catch on saveProject', () => {
  it('updateWorkflow routes rejection to console.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await mountAndWaitForProject();
    act(() => { result.current.updateWorkflow([] as WorkflowState[]); });
    await act(async () => { await Promise.resolve(); });
    expect(consoleSpy).toHaveBeenCalledWith(
      'updateWorkflow: saveProject failed', 'permission-denied',
    );
    consoleSpy.mockRestore();
  });
  it('updateSnapshots routes rejection to console.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await mountAndWaitForProject();
    act(() => { result.current.updateSnapshots([]); });
    await act(async () => { await Promise.resolve(); });
    expect(consoleSpy).toHaveBeenCalledWith(
      'updateSnapshots: saveProject failed', 'permission-denied',
    );
    consoleSpy.mockRestore();
  });
  it('updateSettings routes rejection to console.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await mountAndWaitForProject();
    act(() => {
      result.current.updateSettings({ gridSortNewestFirst: false } as Partial<ProjectSettings>);
    });
    await act(async () => { await Promise.resolve(); });
    expect(consoleSpy).toHaveBeenCalledWith(
      'updateSettings: saveProject failed', 'permission-denied',
    );
    consoleSpy.mockRestore();
  });
});
