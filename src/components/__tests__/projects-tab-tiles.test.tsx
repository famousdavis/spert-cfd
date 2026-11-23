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
// v0.19.0 (DASH26 R1b):
// - R10: the last project may be deleted; focus then goes to New Project (O12).
// - Clone through the tab: O18 (focus stays, nothing opens), O19 (the status
//   region and its words, the failure alert), O20 (which copy), O24.

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
    cloneProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    moveProject: vi.fn(),
  },
  storage: { driver: { mode: 'local' as 'local' | 'cloud', loadProject: vi.fn(), exportProject: vi.fn() } },
  importPhase: { phase: 'idle' } as { phase: string },
  previewCancel: vi.fn(),
}));

vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => h.list }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => h.storage }));
// v0.19.0: the tab reads the loaded project for Clone (O20); none is loaded here.
const activeValue = vi.hoisted(() => ({ project: null as unknown }));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => activeValue }));
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
vi.mock('../sharing-modal', () => ({ SharingModal: ({ projectId }: { projectId: string }) => <div role="dialog" aria-label={`Sharing ${projectId}`} /> }));

import { ProjectsTab } from '../projects-tab';

const THREE: Item[] = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];

beforeEach(() => {
  h.list.projects = THREE;
  h.storage.driver.mode = 'local';
  h.storage.driver.loadProject.mockReset().mockResolvedValue(null);
  h.list.deleteProject.mockReset();
  h.list.renameProject.mockReset();
  h.list.cloneProject.mockReset();
  activeValue.project = null;
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

describe('the last project may be deleted (v0.19.0, DASH26 R10; Char-DASH-1 §B #16 removed)', () => {
  it('Delete on the only tile asks, deletes, says nothing else, and focus goes to New Project (O12\'s third branch)', async () => {
    h.list.projects = [THREE[0]];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    fireEvent.click(button('Delete Alpha'));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Delete "Alpha"? This cannot be undone.');
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });
    expect(h.list.deleteProject).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement).toBe(button('New Project'));
  });
});

describe('Share and the member count, wired through the tab (PR #108 review, -05)', () => {
  it('a cloud owner\'s Share opens the sharing window for that project, and nothing before', () => {
    h.storage.driver.mode = 'cloud';
    h.list.projects = [{ id: 'o', name: 'Own', role: 'owner', memberCount: 1 }, { id: 'p', name: 'Two', role: 'owner', memberCount: 1 }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.queryByRole('dialog', { name: 'Sharing o' })).toBeNull();
    fireEvent.click(button('Share Own'));
    expect(screen.getByRole('dialog', { name: 'Sharing o' })).toBeTruthy();
  });

  it('a sole cloud owner shows no "Shared"; with a second member, "Shared"', () => {
    h.storage.driver.mode = 'cloud';
    h.list.projects = [{ id: 'o', name: 'Own', role: 'owner', memberCount: 1 }, { id: 'p', name: 'Two', role: 'owner', memberCount: 2 }];
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const tile = (id: string) => within(document.querySelector(`li[data-project-id="${id}"]`) as HTMLElement);
    expect(tile('o').queryByText('Shared')).toBeNull();
    expect(tile('p').getByText('Shared')).toBeTruthy();
  });
});

// jsdom loads no CSS, so these pin the CLASS PAIRS that make the dashboard behave,
// not the pixels (SPERT® Forecaster's ProjectList.test.tsx does the same). Each
// half of a pair is useless alone; the browser measured the rendering (P1).
describe('the dashboard\'s class pairs (PR #108 review, -05)', () => {
  const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);
  const tiles = () => [...document.querySelectorAll<HTMLElement>('li[data-tile="true"]')];

  it('the grid\'s column queries are answered by an ANCESTOR carrying @container, never by the grid itself', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const grid = document.querySelector('ul[aria-label="Projects"]')!;
    expect(classes(grid)).toEqual(expect.arrayContaining(['grid-cols-1', '@min-[560px]:grid-cols-2', '@min-[860px]:grid-cols-3', 'gap-4']));
    expect(classes(grid)).not.toContain('@container');
    expect(grid.parentElement!.closest('.\\@container')).not.toBeNull();
  });

  it('the revealed row shows on tile hover, on focus inside the tile and without hover, and the tile root is the group it reads', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const tile = tiles()[0];
    const row = tile.querySelector('button[aria-label^="Export "]')!.parentElement!;
    expect(classes(row)).toEqual(expect.arrayContaining(['opacity-0', 'group-hover/tile:opacity-100', 'group-focus-within/tile:opacity-100', '[@media(hover:none)]:opacity-100']));
    expect(row.closest('.group\\/tile')).toBe(tile);
    expect(classes(tile)).toEqual(expect.arrayContaining(['group/tile', 'relative']));
  });

  it('the name button\'s ::after covers the tile, and the grip, Delete and the revealed row sit above it', () => {
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const tile = tiles()[0];
    expect(classes(tile.querySelector('h3 button')!)).toEqual(expect.arrayContaining(['after:absolute', 'after:inset-0']));
    const grip = tile.querySelector('[title="Drag to reorder"]')!;
    const del = tile.querySelector('button[aria-label^="Delete "]')!.parentElement!;
    const row = tile.querySelector('button[aria-label^="Export "]')!.parentElement!;
    for (const above of [grip, del, row]) expect(classes(above)).toEqual(expect.arrayContaining(['relative', 'z-[1]']));
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

describe('Clone through the tab (v0.19.0, DASH26 R1b)', () => {
  const region = () => document.querySelector('[role="status"][data-clone-status]') as HTMLElement;
  const stored = { id: 'a', name: 'Alpha', createdAt: '2026-01-01', workflow: [], snapshots: [], settings: {} };
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

  it('O19: the polite region is there and empty before the click; then exactly "Cloned "X" as "X (copy)".", read once', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(region()).not.toBeNull();
    expect(region().getAttribute('aria-live')).toBe('polite');
    expect(region().className).toBe('sr-only');
    expect(region().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss clone message' })).toBeNull();
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(region().textContent).toBe('Cloned "Alpha" as "Alpha (copy)".');
    // The visible line repeats it hidden from screen readers, so it is read once (Q3).
    const dismiss = button('Dismiss clone message');
    const visible = dismiss.parentElement!.querySelector('span')!;
    expect(visible.textContent).toBe('Cloned "Alpha" as "Alpha (copy)".');
    expect(visible.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(dismiss);
    expect(region().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss clone message' })).toBeNull();
  });

  it('F5: the same words twice are announced twice: the region is emptied in between (recorded)', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(region().textContent ?? ''));
    observer.observe(region(), { childList: true, characterData: true, subtree: true });
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    await act(async () => { await Promise.resolve(); });
    observer.disconnect();
    const words = 'Cloned "Alpha" as "Alpha (copy)".';
    expect(seen.filter((t) => t === words).length).toBe(2);
    expect(seen.lastIndexOf('')).toBeGreaterThan(seen.indexOf(words));
    expect(seen.at(-1)).toBe(words);
  });

  it('O18: Clone keeps focus and opens nothing', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    const onOpenInCfd = vi.fn();
    render(<ProjectsTab onOpenInCfd={onOpenInCfd} />);
    button('Clone Alpha').focus();
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(document.activeElement).toBe(button('Clone Alpha'));
    expect(onOpenInCfd).not.toHaveBeenCalled();
  });

  it('a source that cannot be read: the alert names it, nothing is cloned', async () => {
    h.storage.driver.loadProject.mockResolvedValue(null);
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Beta')); });
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('Couldn\'t clone "Beta" — the copy wasn\'t saved. Please try again.');
    expect(h.list.cloneProject).not.toHaveBeenCalled();
  });

  it('a refused save: Clone\'s words, or O24\'s when storage is full; either alert clears the clone\'s words', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValueOnce({ id: 'k', name: 'Alpha (copy)' });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(region().textContent).not.toBe('');
    h.list.cloneProject.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('Couldn\'t clone "Alpha" — the copy wasn\'t saved. Please try again.');
    expect(region().textContent).toBe('');
    h.list.cloneProject.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(screen.getByRole('alert').textContent).toContain("This browser's storage is full. Export a project, then delete one to make room.");
  });

  it('O19: another action\'s failure alert clears the clone\'s words too (a failed Load Sample after a clone)', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    h.list.loadSampleProject.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(region().textContent).toBe('Cloned "Alpha" as "Alpha (copy)".');
    await act(async () => { fireEvent.click(button('Load Sample')); });
    await settle();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load the sample project");
    expect(region().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss clone message' })).toBeNull();
  });

  it('O19 (PR #109 review -04): the import\'s error alert clears the clone\'s words too', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    const view = render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    expect(region().textContent).toBe('Cloned "Alpha" as "Alpha (copy)".');
    h.importPhase = { phase: 'error', message: 'Invalid JSON. The file may be corrupted.' } as { phase: string };
    view.rerender(<ProjectsTab onOpenInCfd={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('Invalid JSON.');
    expect(region().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss clone message' })).toBeNull();
  });

  it('O25 (PR #109 review -05): Dismiss on the clone\'s line sends focus to New Project, never <body>', async () => {
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    await settle();
    const dismiss = button('Dismiss clone message');
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(document.activeElement).toBe(button('New Project'));
  });

  it('O20: the open project is copied from memory when the LOADED copy is it', async () => {
    const inMemory = { ...stored, snapshots: [{ date: '2026-02-02', counts: { x: 1 } }] };
    activeValue.project = inMemory;
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    // The stored copy (the driver here holds none: null) would have failed the clone.
    expect(h.list.cloneProject).toHaveBeenCalledWith(inMemory);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('O20: with a switch pending (active id a, loaded copy still b), a clone of a is the STORED a', async () => {
    h.list.activeProjectId = 'a';
    activeValue.project = { ...stored, id: 'b', name: 'Beta' };
    h.storage.driver.loadProject.mockResolvedValue(stored);
    h.list.cloneProject.mockResolvedValue({ id: 'k', name: 'Alpha (copy)' });
    render(<ProjectsTab onOpenInCfd={vi.fn()} />);
    await act(async () => { fireEvent.click(button('Clone Alpha')); });
    expect(h.storage.driver.loadProject).toHaveBeenCalledWith('a');
    expect(h.list.cloneProject).toHaveBeenCalledWith(stored);
    h.list.activeProjectId = null;
  });
});
