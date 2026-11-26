// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N11 (FRAME26, v0.22.0): the Projects tab under the frame, over the real local driver and ProjectListProvider.
// - The heading row: h1 "Projects" and the toolbar, its four buttons the frame's 36 px `.sf-btn`.
// - The ONE filter row (contract §3, "Filter row"; Orch-FRAME-2's D3), `data-sf="filters"`: it renders while
//   something is archived or the person's settings could not be read, and holds "Show archived (N)" and, below it,
//   O54's line. The tile grid follows it.
// - The empty collection (contract §7): the welcome panel and the all-archived line carry `data-sf="empty"`, and an
//   empty panel never shows beside the grid.
// A local read never fails, so O54's line is driven here by a driver stub whose read is `failed`, as in
// projects-tab-archive.test.tsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

const h = vi.hoisted(() => ({ driver: null as unknown }));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver: h.driver, mode: (h.driver as { mode: string }).mode }),
}));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => ({ project: null }) }));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));

import { ProjectListProvider } from '@/contexts/project-list-context';
import { ProjectsTab } from '../projects-tab';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { LS_PROJECT_PREFS } from '@/lib/constants';
import { PREFS_UNREAD_TEXT } from '../archive-controls';

function project(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [{ id: 'bl', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
    snapshots: [],
    settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

async function mount(ids: Array<[string, string]>, prefs?: Record<string, unknown>) {
  const seed = createLocalStorageDriver();
  for (const [id, name] of ids) await seed.createProject(project(id, name));
  if (prefs) localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify(prefs));
  h.driver ??= createLocalStorageDriver();
  const r = render(
    <ProjectListProvider>
      <ProjectsTab onOpenInCfd={vi.fn()} onOpenSample={vi.fn()} />
    </ProjectListProvider>,
  );
  await act(async () => {
    await new Promise((res) => setTimeout(res, 20));
  });
  return r;
}

function failingRead(): StorageDriver {
  const local = createLocalStorageDriver();
  // One object, as a store's snapshot must be: a new one on every read would loop useSyncExternalStore.
  const read: ReturnType<StorageDriver['getProjectPrefs']> = { status: 'failed' };
  return {
    ...local,
    getProjectPrefs: () => read,
    onProjectPrefsChange: () => () => {},
    setProjectPref: () => 'unread',
    retryProjectPrefs: vi.fn(),
  };
}

const filters = () => [...document.querySelectorAll('[data-sf="filters"]')];
const empty = () => [...document.querySelectorAll('[data-sf="empty"]')];
const grid = () => document.querySelector('[data-sf="tiles"]');
/** The rows after the heading row, in order, by what each one is. */
const rows = (root: Element) =>
  [...root.firstElementChild!.children]
    // Not the visually hidden live regions (the tab's own and dnd-kit's): they take no space.
    .filter((e) => !e.classList.contains('sr-only') && e.getAttribute('aria-live') === null && !e.id.startsWith('Dnd'))
    .map((e) => e.getAttribute('data-sf') ?? e.tagName.toLowerCase());

beforeEach(() => {
  localStorage.clear();
  h.driver = null;
});

describe('the Projects tab under the frame', () => {
  it('the heading row: h1 "Projects", the toolbar hooked, its four buttons the frame\'s .sf-btn', async () => {
    const { container } = await mount([['a', 'Alpha']]);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Projects' });
    expect(h1.className).toBe('sf-heading');
    const row = h1.parentElement!;
    expect(row.getAttribute('data-sf')).toBe('headrow');
    const toolbar = row.querySelector('[data-sf="toolbar"]')!;
    expect(toolbar.className).toBe('sf-toolbar');
    expect([...toolbar.children].map((b) => [b.textContent, b.classList.contains('sf-btn')])).toEqual([
      ['Export All', true], ['Import', true], ['Load Sample', true], ['New Project', true],
    ]);
    expect(rows(container)).toEqual(['headrow', 'tiles']);
  });

  it('no filter row while nothing is archived and the settings were read', async () => {
    await mount([['a', 'Alpha']]);
    expect(filters()).toEqual([]);
    expect(empty()).toEqual([]);
  });

  it('something archived: one filter row with "Show archived (N)", then the grid', async () => {
    const { container } = await mount([['a', 'Alpha'], ['b', 'Bravo']], { a: { archived: true } });
    expect(filters()).toHaveLength(1);
    expect(filters()[0].className).toBe('sf-below space-y-2');
    expect(filters()[0].textContent).toBe('Show archived (1)');
    expect(rows(container)).toEqual(['headrow', 'filters', 'tiles']);
    expect(empty()).toEqual([]);
  });

  it('every project archived, the filter off: the filter row, then the all-archived line, hooked empty, no grid', async () => {
    const { container } = await mount([['a', 'Alpha']], { a: { archived: true } });
    expect(rows(container)).toEqual(['headrow', 'filters', 'empty']);
    expect(empty()[0].textContent).toBe('All projects are archived. Select "Show archived (1)" to see them.');
    expect(grid()).toBeNull();
    await act(async () => { fireEvent.click(screen.getByLabelText('Show archived (1)')); });
    expect(rows(container)).toEqual(['headrow', 'filters', 'tiles']);
    expect(empty()).toEqual([]);
  });

  it('a failed read (O54): its line inside the one filter row, role=status, then the grid', async () => {
    h.driver = failingRead();
    const { container } = await mount([['a', 'Alpha']]);
    expect(filters()).toHaveLength(1);
    const line = screen.getByText(PREFS_UNREAD_TEXT);
    expect(line.getAttribute('role')).toBe('status');
    expect(line.parentElement).toBe(filters()[0]);
    expect(screen.queryByLabelText(/Show archived/)).toBeNull();
    expect(rows(container)).toEqual(['headrow', 'filters', 'tiles']);
  });

  it('with both, the line sits below the filter, in the same row', async () => {
    // A read that failed has no map, so nothing counts as archived: the two never show together in the app. This
    // pins only the row's order, if they ever did.
    const { ArchiveRows } = await import('../archive-controls');
    render(<ArchiveRows archivedCount={2} showArchived={false} onShowArchivedChange={vi.fn()} unread status="" />);
    const row = filters()[0];
    expect([...row.children].map((e) => e.textContent)).toEqual(['Show archived (2)', PREFS_UNREAD_TEXT]);
  });

  // v0.23.0 (FRAME26 clean-up W): the hook is on the Welcome panel itself, whose `.sf-empty` puts it 16 px down.
  it('no projects: the Welcome panel, hooked empty itself (.sf-empty, 16 px down) and never beside a grid', async () => {
    const { container } = await mount([]);
    expect(empty()).toHaveLength(1);
    expect(empty()[0].className).toBe('sf-empty');
    expect(empty()[0].getAttribute('role')).toBe('region');
    expect(grid()).toBeNull();
    expect(rows(container)).toEqual(['headrow', 'empty']);
  });
});
