// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// A create that fails must be visible to the user (QC26 Q01, PC4). Before
// v0.15.19 the failure reached only console.error: the card vanished later,
// unexplained. The context's half — card removed, previous project restored —
// is pinned in src/contexts/__tests__/cloud-create-open.test.tsx; this file
// pins the half the user reads.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Stable identities: ProjectsTab's stats effect depends on `projects` and
// `driver`, so fresh objects per render would re-run it without end.
const { createProject, listValue, storageValue } = vi.hoisted(() => {
  const createProject = vi.fn();
  return {
    createProject,
    listValue: {
      projects: [],
      activeProjectId: null,
      driverLoading: false,
      createProject,
      deleteProject: () => {},
      renameProject: () => {},
      reorderProjects: () => {},
    },
    storageValue: { driver: { mode: 'cloud', loadProject: async () => null } },
  };
});

vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: () => listValue,
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => storageValue,
}));
const authValue = vi.hoisted(() => ({ user: null }));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => authValue,
}));
vi.mock('@/hooks/use-import-state', () => ({
  useImportState: () => ({
    flowPhase: { phase: 'idle' },
    applying: false,
    inputRef: { current: null },
    setDecision: vi.fn(),
    handleImportClick: vi.fn(),
    handleFileChange: vi.fn(),
    handleConfirmImport: vi.fn(),
    handleCancel: vi.fn(),
    handleReplaceConfirmed: vi.fn(),
    dismissReplaceConfirm: vi.fn(),
    handleDismissBanner: vi.fn(),
  }),
}));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));

import { ProjectsTab } from '../projects-tab';

describe('Projects tab: creating a project', () => {
  it('says so when the project could not be saved', async () => {
    createProject.mockReturnValue(
      Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })),
    );
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.change(screen.getByLabelText('New project name'), { target: { value: 'Beta' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });

    expect(createProject).toHaveBeenCalledWith('Beta');
    expect(screen.getByRole('alert').textContent).toContain(
      'Couldn\'t create "Beta" — it wasn\'t saved. Please try again.',
    );
  });
});
