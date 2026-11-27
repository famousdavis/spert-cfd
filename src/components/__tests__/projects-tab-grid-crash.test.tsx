// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.23.0 (FRAME26 clean-up C17): the Projects tab's heading row is outside
// the boundary around its body, so a tile, the grid or a dialog that fails
// leaves the page's h1 and the four toolbar buttons in place, with the view
// notice where the body was. Until v0.23.0 the shell's boundary around the
// whole tab replaced the h1 too. The scaffold is projects-tab-toolbar's.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const h = vi.hoisted(() => {
  const createProject = vi.fn();
  const loadSampleProject = vi.fn();
  const handleImportClick = vi.fn();
  return {
    createProject,
    loadSampleProject,
    handleImportClick,
    listValue: {
      projects: [] as Array<{ id: string; name: string }>,
      activeProjectId: null as string | null,
      driverLoading: false,
      createProject,
      loadSampleProject,
      deleteProject: () => {},
      renameProject: () => {},
      moveProject: () => {},
    },
    prefsReady: { status: 'ready' as const, prefs: {} },
    storageValue: { driver: { mode: 'local', loadProject: async () => null, getProjectPrefs: () => h.prefsReady, onProjectPrefsChange: () => () => {}, setProjectPref: () => null, onProjectPrefsRefused: () => () => {}, retryProjectPrefs: () => {} } },
  };
});

vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: () => h.listValue,
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => h.storageValue,
}));
// v0.19.0: the tab reads the loaded project for Clone (O20); none is loaded here.
const activeValue = vi.hoisted(() => ({ project: null as unknown }));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => activeValue }));
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
    handleImportClick: h.handleImportClick,
    handleFileChange: vi.fn(),
    handleConfirmImport: vi.fn(),
    handleCancel: vi.fn(),
    handleReplaceConfirmed: vi.fn(),
    dismissReplaceConfirm: vi.fn(),
    handleDismissBanner: vi.fn(),
  }),
}));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));
// v0.18.0: the tile is SortableProjectTile; this mock still intercepts the real
// export (a missing export on a mocked module throws, so a rename shows here).
// A tile that fails to render, as a corrupt record or a bug in the tile would.
vi.mock('../project-row', () => ({
  SortableProjectTile: ({ name }: { name: string }) => {
    if (name === 'Broken') throw new Error('a tile that cannot render');
    return <li>{name}</li>;
  },
}));

import { ProjectsTab } from '../projects-tab';

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.listValue.driverLoading = false;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('a crash in the grid', () => {
  it('keeps the heading row: the h1 "Projects" and Export All, Import, Load Sample, New Project', () => {
    h.listValue.projects = [{ id: 'a', name: 'Alpha' }, { id: 'x', name: 'Broken' }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} onOpenSample={vi.fn()} />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Projects' });
    const row = heading.parentElement!;
    expect(row.getAttribute('data-sf')).toBe('headrow');
    expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(['Export All', 'Import', 'Load Sample', 'New Project']);
    expect(screen.getByRole('alert').textContent).toContain('This view could not be displayed.');
    // The body is gone, not half-drawn.
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(document.querySelector('[data-sf="tiles"]')).toBeNull();
  });

  it('control: the same tab with no broken tile shows the grid and no notice', () => {
    h.listValue.projects = [{ id: 'a', name: 'Alpha' }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} onOpenSample={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
