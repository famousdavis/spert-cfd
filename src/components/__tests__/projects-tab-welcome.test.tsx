// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.19.0 (DASH26 R11, R27, O21, R12, O24): the Projects tab with no projects.
// - The welcome panel: its words; shown only when the list is empty, loaded
//   (!driverLoading) and no import preview is open.
// - Forecaster's pending line while the cloud list loads with nothing listed.
// - The panel's buttons: Create New Project opens the dialog (focus returns to
//   the toolbar's New Project); Load Sample Project moves focus to the
//   toolbar's Load Sample BEFORE the insert unmounts the panel, so focus never
//   sits on <body> while the save is pending or after it fails.
// - O24's words for Create and Load Sample when storage is full.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  list: {
    projects: [] as Array<{ id: string; name: string }>,
    activeProjectId: null as string | null,
    driverLoading: false,
    createProject: vi.fn(),
    loadSampleProject: vi.fn(),
    cloneProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    moveProject: vi.fn(),
  },
  prefsReady: { status: 'ready' as const, prefs: {} },
  storage: { driver: { mode: 'local' as 'local' | 'cloud', loadProject: async () => null, getProjectPrefs: () => h.prefsReady, onProjectPrefsChange: () => () => {}, setProjectPref: () => null, onProjectPrefsRefused: () => () => {}, retryProjectPrefs: () => {} } },
  importFlow: { phase: 'idle' } as { phase: string },
  active: { project: null as unknown },
}));
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => h.list }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => h.storage }));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => h.active }));
vi.mock('@/hooks/use-import-state', () => ({
  useImportState: () => ({
    flowPhase: h.importFlow,
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
vi.mock('../import-preview-section', () => ({ ImportPreviewSection: () => <section aria-label="Import preview" /> }));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));

import { ProjectsTab, CLOUD_PENDING_TEXT } from '../projects-tab';
import { PANEL_SECONDARY } from '../projects-empty-state';

const WELCOME = 'Welcome to SPERT® CFD';
const panel = () => screen.queryByRole('region', { name: WELCOME });
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  h.list.projects = [];
  h.list.driverLoading = false;
  h.list.createProject.mockReset();
  h.list.loadSampleProject.mockReset();
  h.importFlow = { phase: 'idle' };
});

describe('the welcome panel (R11, R27)', () => {
  it('says R27\'s words, with Create New Project and Load Sample Project', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const region = panel()!;
    expect(within(region).getByRole('heading', { level: 2 }).textContent).toBe(WELCOME);
    const texts = [...region.querySelectorAll('p')].map((p) => p.textContent);
    expect(texts).toEqual([
      'See how work items flow through your process over time, and spot bottlenecks and WIP buildup early.',
      'The sample project is a working example with 14 days of snapshots. You can explore it, edit it, or delete it at any time.',
    ]);
    expect(within(region).getAllByRole('button').map((b) => b.textContent)).toEqual(['Create New Project', 'Load Sample Project']);
  });

  it('is drawn as Forecaster\'s panel: 10 px corners, 1 px dashed #e5e5e5, white, 32 px padding, centred (class pairs; P1 measures)', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const cls = panel()!.className.split(' ');
    expect(cls).toEqual(expect.arrayContaining(['rounded-[10px]', 'border', 'border-dashed', 'border-[#e5e5e5]', 'bg-white', 'p-8', 'text-center', 'dark:border-gray-700', 'dark:bg-[#171717]']));
    // Load Sample Project is transparent in dark on the panel; the toolbar's dark gray-900 is replaced, not overridden.
    expect(PANEL_SECONDARY).toContain('dark:bg-transparent');
    expect(PANEL_SECONDARY).not.toContain('dark:bg-gray-900');
  });

  it('shows only with no projects', () => {
    h.list.projects = [{ id: 'a', name: 'Alpha' }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(panel()).toBeNull();
  });

  it('never under an import preview', () => {
    h.importFlow = { phase: 'preview' };
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Import preview' })).toBeTruthy();
    expect(panel()).toBeNull();
  });

  it('while the list loads with nothing listed: Forecaster\'s pending line, politely, and no panel (O21)', () => {
    h.list.driverLoading = true;
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const line = screen.getByText(CLOUD_PENDING_TEXT);
    expect(CLOUD_PENDING_TEXT).toBe('Loading your cloud projects — import will be available shortly.');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.getAttribute('aria-live')).toBe('polite');
    expect(panel()).toBeNull();
  });

  it('the pending line goes once something is listed, even while still loading', () => {
    h.list.driverLoading = true;
    h.list.projects = [{ id: 'a', name: 'Alpha' }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.queryByText(CLOUD_PENDING_TEXT)).toBeNull();
  });
});

describe('the panel\'s buttons (R12, Opus-R1b-1 -12)', () => {
  it('Create New Project opens the New Project dialog; Cancel returns focus to the toolbar\'s New Project', async () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Create New Project'));
    const dialog = screen.getByRole('dialog', { name: 'New Project' });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); });
    expect(document.activeElement).toBe(button('New Project'));
  });

  it('Load Sample Project: focus is on the toolbar\'s Load Sample when the insert starts, and the CFD tab opens once saved', async () => {
    let focusedAtStart: Element | null = null;
    h.list.loadSampleProject.mockImplementation(() => {
      focusedAtStart = document.activeElement;
      return Promise.resolve('sample-id');
    });
    const onOpenInCfd = vi.fn();
    render(<ProjectsTab onOpenInCfd={onOpenInCfd} />);
    const toolbarLoadSample = button('Load Sample');
    await act(async () => { fireEvent.click(button('Load Sample Project')); });
    expect(focusedAtStart).toBe(toolbarLoadSample);
    expect(onOpenInCfd).toHaveBeenCalledWith('sample-id');
  });

  it('Load Sample Project that fails: the alert, and focus still on the toolbar\'s Load Sample, never <body>', async () => {
    h.list.loadSampleProject.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const onOpenInCfd = vi.fn();
    render(<ProjectsTab onOpenInCfd={onOpenInCfd} />);
    await act(async () => { fireEvent.click(button('Load Sample Project')); });
    expect(onOpenInCfd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load the sample project — it wasn't saved. Please try again.");
    expect(document.activeElement).toBe(button('Load Sample'));
  });
});

describe('storage full, on the add paths (O24)', () => {
  const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  const O24 = "This browser's storage is full. Export a project, then delete one to make room.";

  it('Load Sample says so in O24\'s words', async () => {
    h.list.loadSampleProject.mockRejectedValue(quota());
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Load Sample')); });
    expect(screen.getByRole('alert').textContent).toContain(O24);
  });

  it('Create says so in O24\'s words; another failure keeps Create\'s', async () => {
    h.list.createProject.mockRejectedValueOnce(quota());
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('New Project'));
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Big' } });
    await act(async () => { fireEvent.click(button('Create')); });
    expect(screen.getByRole('alert').textContent).toContain(O24);
    h.list.createProject.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    fireEvent.click(button('New Project'));
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Small' } });
    await act(async () => { fireEvent.click(button('Create')); });
    expect(screen.getByRole('alert').textContent).toContain('Couldn\'t create "Small" — it wasn\'t saved. Please try again.');
  });
});
