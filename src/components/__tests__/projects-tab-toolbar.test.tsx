// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.17.0: the Projects tab's first row is its heading and the suite's
// dashboard toolbar — Export All · Import · Load Sample · New Project — with
// every button always rendered. New Project asks for the name in a dialog.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

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
    storageValue: { driver: { mode: 'local', loadProject: async () => null, getProjectPrefs: () => h.prefsReady, onProjectPrefsChange: () => () => {}, setProjectPref: () => null, retryProjectPrefs: () => {} } },
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
vi.mock('../project-row', () => ({
  SortableProjectTile: ({ name }: { name: string }) => <li>{name}</li>,
}));

import { ProjectsTab } from '../projects-tab';
import { MAX_NAME_LENGTH } from '@/lib/constants';

const PROJECTS = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }];
const TOOLBAR = ['Export All', 'Import', 'Load Sample', 'New Project'];

/** The visible label of each button in the heading row, in order. */
function toolbarLabels() {
  const row = screen.getByRole('heading', { name: 'Projects' }).parentElement!;
  return within(row).getAllByRole('button').map((b) => b.textContent);
}

beforeEach(() => {
  h.listValue.projects = PROJECTS;
  h.listValue.driverLoading = false;
  h.createProject.mockReset().mockResolvedValue('new-id');
  h.loadSampleProject.mockReset().mockResolvedValue('sample-id');
  h.handleImportClick.mockReset();
});

describe('Projects tab: the heading and toolbar row', () => {
  it('shows the heading, then the four buttons in the suite order', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    // v0.18.0: "Projects", as across the suite, with no count.
    expect(screen.getByRole('heading', { name: 'Projects', level: 2 })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /^Projects \(/ })).toBeNull();
    expect(toolbarLabels()).toEqual(TOOLBAR);
  });

  it('keeps every button, in the same order, with no projects; Export All is disabled, not hidden', () => {
    h.listValue.projects = [];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(toolbarLabels()).toEqual(TOOLBAR);
    expect((screen.getByRole('button', { name: 'Export all projects as JSON' }) as HTMLButtonElement).disabled).toBe(true);
    // v0.19.0 (DASH26 R11; Char-DASH-1 §B #33 changed): the welcome panel replaces "No projects yet…".
    expect(screen.getByRole('region', { name: 'Welcome to SPERT® CFD' })).toBeTruthy();
    expect(screen.queryByText('No projects yet. Use New Project, Load Sample or Import.')).toBeNull();
  });

  it('keeps every button while the project list is loading; only Import is disabled', () => {
    h.listValue.driverLoading = true;
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(toolbarLabels()).toEqual(TOOLBAR);
    const disabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;
    expect(disabled('Import projects from JSON')).toBe(true);
    expect(disabled('Export all projects as JSON')).toBe(false);
    expect(disabled('Load Sample')).toBe(false);
    expect(disabled('New Project')).toBe(false);
  });

  it('names begin with the visible label (Label in Name), and the icons are hidden', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    for (const label of TOOLBAR) {
      const button = screen.getByRole('button', { name: new RegExp(`^${label}`, 'i') });
      expect(button.textContent).toBe(label);
      expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('Import opens the file picker', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import projects from JSON' }));
    expect(h.handleImportClick).toHaveBeenCalledTimes(1);
  });
});

describe('Projects tab: Load Sample', () => {
  it('loads a sample and opens it once it is saved', async () => {
    const onOpenInCfd = vi.fn();
    render(<ProjectsTab onOpenInCfd={onOpenInCfd} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Load Sample' })); });
    expect(h.loadSampleProject).toHaveBeenCalledTimes(1);
    expect(onOpenInCfd).toHaveBeenCalledWith('sample-id');
  });

  it('says so, and opens nothing, when the sample could not be saved', async () => {
    h.loadSampleProject.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const onOpenInCfd = vi.fn();
    render(<ProjectsTab onOpenInCfd={onOpenInCfd} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Load Sample' })); });
    expect(onOpenInCfd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load the sample project");
  });
});

describe('Projects tab: the New Project dialog', () => {
  function open() {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'New Project' });
    fireEvent.click(trigger);
    return { trigger, dialog: screen.getByRole('dialog', { name: 'New Project' }) };
  }

  it('has no inline name field on the tab', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.queryByLabelText('Project Name')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('focuses the name field; Create stays disabled while the name is blank', () => {
    const { dialog } = open();
    const input = within(dialog).getByLabelText('Project Name') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    const create = within(dialog).getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(create.disabled).toBe(true);
    expect(input.maxLength).toBe(MAX_NAME_LENGTH);
  });

  it('Enter creates the project with the trimmed name, closes, and returns focus to New Project', () => {
    const { trigger, dialog } = open();
    const input = within(dialog).getByLabelText('Project Name');
    fireEvent.change(input, { target: { value: '  Gamma  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(h.createProject).toHaveBeenCalledWith('Gamma');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Enter on a blank name creates nothing and keeps the dialog open', () => {
    const { dialog } = open();
    fireEvent.submit(within(dialog).getByLabelText('Project Name').closest('form')!);
    expect(h.createProject).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Escape cancels, creates nothing, and returns focus to New Project', () => {
    const { trigger } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.createProject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('Cancel closes, creates nothing, and returns focus to New Project', () => {
    const { trigger, dialog } = open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.createProject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });
});
