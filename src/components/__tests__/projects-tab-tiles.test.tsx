// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R1a): the Projects tab with its real tiles.
// - P5: access comes from the list item, never the stats load. Cloud: owner,
//   editor, viewer; local: nothing gated, whatever the item carries. Delete
//   never shows disabled while the stats load.
// - O12 / D7: focus after the Delete confirmation.
// - Edit: one dialog, renames through renameProject; closes if its project
//   leaves the list (L9).
// - One Escape in the dialog leaves a waiting import preview alone.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useEscapeKey } from '@/lib/use-dismiss';
import type { ProjectListItem } from '@/lib/storage-driver';

type Item = ProjectListItem;
const h = vi.hoisted(() => ({
  list: {
    projects: [] as Item[],
    activeProjectId: null as string | null,
    driverLoading: false,
    createProject: vi.fn(),
    loadSampleProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    reorderProjects: vi.fn(),
  },
  storage: { driver: { mode: 'local' as 'local' | 'cloud', loadProject: vi.fn(), exportProject: vi.fn() } },
  importPhase: { phase: 'idle' } as { phase: string },
  previewCancel: vi.fn(),
}));

vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => h.list }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => h.storage }));
vi.mock('@/hooks/use-import-state', () => ({
  useImportState: () => ({
    flowPhase: h.importPhase,
    applying: false,
    inputRef: { current: null },
    setDecision: vi.fn(),
    handleImportClick: vi.fn(),
    handleFileChange: vi.fn(),
    handleConfirmImport: vi.fn(),
    handleCancel: h.previewCancel,
    handleReplaceConfirmed: vi.fn(),
    dismissReplaceConfirm: vi.fn(),
    handleDismissBanner: vi.fn(),
  }),
}));
// The preview's Escape, by its real mechanism: a bubble-phase document listener.
vi.mock('../import-preview-section', () => ({
  ImportPreviewSection: ({ onCancel }: { onCancel: () => void }) => {
    useEscapeKey(onCancel);
    return <section aria-label="Import preview">Preview</section>;
  },
}));
vi.mock('../sharing-modal', () => ({ SharingModal: () => <div role="dialog" aria-label="Sharing" /> }));

import { ProjectsTab } from '../projects-tab';

const THREE: Item[] = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];

beforeEach(() => {
  h.list.projects = THREE;
  h.storage.driver.mode = 'local';
  h.storage.driver.loadProject.mockReset().mockResolvedValue(null);
  h.list.deleteProject.mockReset();
  h.list.renameProject.mockReset();
  h.importPhase = { phase: 'idle' };
  h.previewCancel.mockReset();
});

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('access, from the list item (P5)', () => {
  it('local mode: no badge and no gate, even for an item that carries a role (a kept cloud copy)', () => {
    h.list.projects = [{ id: 'a', name: 'Alpha', role: 'viewer', memberCount: 3 }, { id: 'b', name: 'Beta' }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.queryByText('Shared')).toBeNull();
    expect(screen.queryByText('View only')).toBeNull();
    expect(button('Delete Alpha').disabled).toBe(false);
    expect(button('Edit Alpha').disabled).toBe(false);
    expect(screen.queryByRole('button', { name: /^Share / })).toBeNull();
  });

  it('cloud: owner, editor, viewer and a role not known yet', () => {
    h.storage.driver.mode = 'cloud';
    h.list.projects = [
      { id: 'o', name: 'Own', role: 'owner', memberCount: 2 },
      { id: 'e', name: 'Ed', role: 'editor', memberCount: 2 },
      { id: 'v', name: 'View', role: 'viewer', memberCount: 3 },
      { id: 'n', name: 'New' },
    ];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const tile = (id: string) => within(document.querySelector(`li[data-project-id="${id}"]`) as HTMLElement);
    // owner
    expect(tile('o').getByText('Shared')).toBeTruthy();
    expect(tile('o').getByRole('button', { name: 'Share Own' })).toBeTruthy();
    expect((tile('o').getByRole('button', { name: 'Delete Own' }) as HTMLButtonElement).disabled).toBe(false);
    // editor
    expect(tile('e').getByText('Shared')).toBeTruthy();
    expect(tile('e').queryByRole('button', { name: 'Share Ed' })).toBeNull();
    expect((tile('e').getByRole('button', { name: 'Delete Ed' }) as HTMLButtonElement).disabled).toBe(true);
    expect((tile('e').getByRole('button', { name: 'Edit Ed' }) as HTMLButtonElement).disabled).toBe(false);
    // viewer
    expect(tile('v').getByText('View only')).toBeTruthy();
    expect(tile('v').queryByText('Shared')).toBeNull();
    expect((tile('v').getByRole('button', { name: 'Delete View' }) as HTMLButtonElement).disabled).toBe(true);
    expect((tile('v').getByRole('button', { name: 'Edit View' }) as HTMLButtonElement).disabled).toBe(true);
    // a project this browser is still creating
    expect(tile('n').queryByRole('button', { name: 'Share New' })).toBeNull();
    expect((tile('n').getByRole('button', { name: 'Delete New' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a cloud owner\'s Delete is enabled before the stats load, and stays so', async () => {
    h.storage.driver.mode = 'cloud';
    h.list.projects = [{ id: 'o', name: 'Own', role: 'owner', memberCount: 1 }, { id: 'p', name: 'Two', role: 'owner', memberCount: 1 }];
    let release!: () => void;
    h.storage.driver.loadProject.mockImplementation(() => new Promise((r) => { release = () => r({ snapshots: [], workflow: [{}] }); }));
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
    expect(button('Delete Own').disabled).toBe(false);
    await act(async () => { release(); });
    expect(button('Delete Own').disabled).toBe(false);
  });
});

describe('the tiles\' meta lines and the stats load (Char-DASH-1 §B #19, #22)', () => {
  it('shows each project\'s counts and latest snapshot once loaded; one unreadable project leaves the others', async () => {
    h.storage.driver.loadProject.mockImplementation(async (id: string) => {
      if (id === 'b') throw new Error('unreadable');
      return { snapshots: [{ date: '2026-06-18' }, { date: '2026-05-01' }], workflow: [{}, {}, {}] };
    });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => {});
    const tile = (id: string) => within(document.querySelector(`li[data-project-id="${id}"]`) as HTMLElement);
    expect(tile('a').getByText('2 snapshots · 3 states')).toBeTruthy();
    expect(tile('a').getByText('Last snapshot Jun 18, 2026')).toBeTruthy();
    expect(tile('b').getByText('Loading…')).toBeTruthy();
    expect(tile('c').getByText('Last snapshot Jun 18, 2026')).toBeTruthy();
    // No open-project marker on the tiles any more (R8): the CFD tab names the open project.
    expect(screen.queryByText('Active')).toBeNull();
  });
});

describe('the last-project rule (§B #16, unchanged in R1a)', () => {
  it('Delete on the only tile stays enabled, opens no confirmation and says why', () => {
    h.list.projects = [THREE[0]];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(button('Delete Alpha').disabled).toBe(false);
    fireEvent.click(button('Delete Alpha'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Cannot delete the last project.');
    expect(h.list.deleteProject).not.toHaveBeenCalled();
  });
});

describe('focus after the Delete confirmation (O12, D7)', () => {
  async function confirmDelete(name: string) {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button(`Delete ${name}`));
    await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' })); });
  }

  it('deletes, then focuses the next tile', async () => {
    await confirmDelete('Beta');
    expect(h.list.deleteProject).toHaveBeenCalledWith('b');
    expect(document.activeElement).toBe(button('Open CFD for Gamma'));
  });

  it('the previous tile when the last one goes', async () => {
    await confirmDelete('Gamma');
    expect(document.activeElement).toBe(button('Open CFD for Beta'));
  });

  it('Cancel returns focus to that tile\'s Delete and deletes nothing', async () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Delete Beta'));
    await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })); });
    expect(h.list.deleteProject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button('Delete Beta'));
  });

  it('Escape returns focus to that tile\'s Delete', async () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Delete Beta'));
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(button('Delete Beta'));
  });
});

describe('Edit (one dialog, R1a §2.4)', () => {
  it('opens named "Edit Project" with the name, renames through renameProject, returns focus to that Edit', async () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Edit Beta'));
    const dialog = screen.getByRole('dialog', { name: 'Edit Project' });
    const input = within(dialog).getByLabelText('Project Name') as HTMLInputElement;
    expect(input.value).toBe('Beta');
    fireEvent.change(input, { target: { value: 'Bravo' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Update' })); });
    expect(h.list.renameProject).toHaveBeenCalledWith('b', 'Bravo');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button('Edit Beta'));
  });

  it('an unchanged name saves nothing', async () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Edit Beta'));
    await act(async () => { fireEvent.click(button('Update')); });
    expect(h.list.renameProject).not.toHaveBeenCalled();
  });

  it('closes, saving nothing, when its project leaves the list (L9)', () => {
    const view = render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Edit Beta'));
    h.list.projects = [THREE[0], THREE[2]];
    view.rerender(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.list.renameProject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button('New Project'));
  });
});

describe('one Escape, one surface', () => {
  it('Escape in the New Project dialog leaves a waiting import preview', () => {
    h.importPhase = { phase: 'preview', incoming: [], conflicts: [], decisions: {} } as never;
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('New Project'));
    fireEvent.keyDown(screen.getByLabelText('Project Name'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'New Project' })).toBeNull();
    expect(h.previewCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Import preview' })).toBeTruthy();
  });

  it('Escape on the Delete confirmation leaves a waiting import preview (D2)', async () => {
    h.importPhase = { phase: 'preview', incoming: [], conflicts: [], decisions: {} } as never;
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Delete Beta'));
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.previewCancel).not.toHaveBeenCalled();
  });

  it('control: Escape with no dialog open does reach the preview', () => {
    h.importPhase = { phase: 'preview', incoming: [], conflicts: [], decisions: {} } as never;
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(h.previewCancel).toHaveBeenCalledTimes(1);
  });
});
