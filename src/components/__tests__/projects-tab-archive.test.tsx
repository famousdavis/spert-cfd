// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R2): tile colour and archive on the Projects tab, over the
// real local driver and the real ProjectListProvider. A second local driver
// stands for the stored map's other writers.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

const h = vi.hoisted(() => ({ driver: null as unknown, download: vi.fn() }));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver: h.driver, mode: (h.driver as { mode: string }).mode }),
}));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => ({ project: null }) }));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));
vi.mock('@/lib/download', async (original) => ({
  ...(await original<typeof import('@/lib/download')>()),
  downloadFile: (...args: unknown[]) => h.download(...args),
}));

import { ProjectListProvider } from '@/contexts/project-list-context';
import { ProjectsTab } from '../projects-tab';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { LS_PROJECT_PREFS } from '@/lib/constants';
import { STORAGE_FULL_MESSAGE } from '@/lib/storage-errors';
import { PREFS_UNREAD_REASON, PREFS_UNREAD_TEXT, REFUSED_ID_REASON } from '../archive-controls';
import { PREFS_CAP_MESSAGE } from '../use-project-archive';

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

const onOpen = vi.fn();
async function mount(ids: Array<[string, string]> = [['a', 'Alpha'], ['b', 'Bravo'], ['c', 'Charlie']], prefs?: Record<string, unknown>) {
  const seed = createLocalStorageDriver();
  for (const [id, name] of ids) await seed.createProject(project(id, name));
  if (prefs) localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify(prefs));
  h.driver ??= createLocalStorageDriver();
  const r = render(
    <ProjectListProvider>
      <ProjectsTab onOpenInCfd={onOpen} />
    </ProjectListProvider>,
  );
  await act(async () => {
    await new Promise((res) => setTimeout(res, 20));
  });
  return r;
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('[data-tile="true"]')].map((t) => t.dataset.projectId);
const tile = (id: string) => document.querySelector<HTMLElement>(`[data-project-id="${id}"]`)!;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const stored = () => JSON.parse(localStorage.getItem(LS_PROJECT_PREFS) ?? 'null');
const click = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
    await new Promise((res) => setTimeout(res, 0));
  });
};
const live = () => document.querySelector('p[aria-live="polite"][aria-atomic="true"]')!.textContent;

beforeEach(() => {
  localStorage.clear();
  h.driver = null;
  onOpen.mockReset();
  h.download.mockReset();
});

describe('Archive and Show archived (N) (O50)', () => {
  it('no filter while nothing is archived; Archive hides the tile, announces it, and focus goes to the next shown tile', async () => {
    await mount();
    expect(screen.queryByLabelText(/Show archived/)).toBeNull();
    await click(button('Archive Bravo'));
    expect(tiles()).toEqual(['a', 'c']);
    expect(stored()).toEqual({ b: { archived: true } });
    expect(live()).toBe('Archived "Bravo". Show archived (1) lists it.');
    expect(document.activeElement).toBe(button('Open CFD for Charlie'));
    expect((screen.getByLabelText('Show archived (1)') as HTMLInputElement).checked).toBe(false);
  });

  it('Show archived lists the archived tile in its slot, with its look; Unarchive is always there and focus goes to Archive', async () => {
    await mount(undefined, { b: { archived: true, color: 'teal' } });
    await click(screen.getByLabelText('Show archived (1)'));
    expect(tiles()).toEqual(['a', 'b', 'c']);
    const b = tile('b');
    expect(b.dataset.archived).toBe('true');
    expect(b.className).toContain('border-dashed');
    expect(b.className).toContain('color-mix(in_srgb,#d9f4f1_50%,#f9f9f9)');
    expect(within(b).getByText('Archived')).toBeTruthy();
    expect(within(b).queryByRole('button', { name: 'Archive Bravo' })).toBeNull();
    await click(within(b).getByRole('button', { name: 'Unarchive Bravo' }));
    expect(stored()).toEqual({ b: { color: 'teal' } });
    expect(live()).toBe('Unarchived "Bravo".');
    expect(document.activeElement).toBe(button('Archive Bravo'));
    expect(screen.queryByLabelText(/Show archived/)).toBeNull(); // N back to 0: the filter goes, off
  });

  it('with Show archived on, Archive keeps the tile and focus goes to its Unarchive', async () => {
    await mount(undefined, { a: { archived: true } });
    await click(screen.getByLabelText('Show archived (1)'));
    await click(button('Archive Charlie'));
    expect(tiles()).toEqual(['a', 'b', 'c']);
    expect(document.activeElement).toBe(button('Unarchive Charlie'));
    expect(live()).toBe('Archived "Charlie".');
  });

  it('every project archived: the all-archived line, never the welcome panel', async () => {
    await mount([['a', 'Alpha']], { a: { archived: true } });
    expect(screen.getByText('All projects are archived. Select "Show archived (1)" to see them.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /Welcome/ })).toBeNull();
  });

  it('an archived tile\'s name unarchives and opens the CFD tab, with no message after (O58)', async () => {
    await mount(undefined, { b: { archived: true } });
    await click(screen.getByLabelText('Show archived (1)'));
    await click(button('Unarchive and open CFD for Bravo'));
    expect(onOpen).toHaveBeenCalledWith('b');
    expect(stored()).toBeNull();
    expect(live()).toBe('');
  });
});

describe('Tile color', () => {
  it('a pick tints the tile and is stored per field; colouring an archived tile keeps it archived (G1)', async () => {
    await mount(undefined, { b: { archived: true } });
    await click(button('Tile color for Alpha: No color'));
    await click(screen.getByRole('radio', { name: 'Pink' }));
    expect(tile('a').dataset.color).toBe('pink');
    expect(tile('a').className).toContain('bg-[#fce2ef]');
    expect(button('Tile color for Alpha: Pink')).toBeTruthy();
    await click(screen.getByLabelText('Show archived (1)'));
    await click(button('Tile color for Bravo: No color'));
    await click(screen.getByRole('radio', { name: 'Blue' }));
    expect(stored()).toEqual({ a: { color: 'pink' }, b: { archived: true, color: 'blue' } });
  });

  it('storage full: the pick is refused, the tile unchanged and R25\'s words shown (O63)', async () => {
    await mount();
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === LS_PROJECT_PREFS) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, k, v);
    });
    try {
      await click(button('Archive Alpha'));
    } finally {
      spy.mockRestore();
    }
    expect(tiles()).toEqual(['a', 'b', 'c']);
    expect(screen.getByRole('alert').textContent).toContain(STORAGE_FULL_MESSAGE);
  });

  it('the 1,000-entry cap refuses a new entry with a message', async () => {
    const full: Record<string, unknown> = {};
    for (let i = 0; i < 1000; i++) full[`gone${i}`] = { archived: true };
    await mount(undefined, full);
    await click(button('Archive Alpha'));
    expect(tiles()).toEqual(['a', 'b', 'c']);
    expect(screen.getByRole('alert').textContent).toContain(PREFS_CAP_MESSAGE);
  });

  it('a project whose id no entry may have: Tile color and Archive disabled, with the reason (O60)', async () => {
    await mount([['a', 'Alpha'], ['hasOwnProperty', 'Odd']]);
    const archive = button('Archive Odd') as HTMLButtonElement;
    expect(archive.disabled).toBe(true);
    expect(archive.title).toBe(REFUSED_ID_REASON);
    expect((button('Tile color for Odd: No color') as HTMLButtonElement).disabled).toBe(true);
    expect((button('Archive Alpha') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the full list stays the full list (O61)', () => {
  it('Export All exports archived projects too', async () => {
    await mount(undefined, { b: { archived: true } });
    await click(button('Export all projects as JSON'));
    const json = JSON.parse(h.download.mock.calls[0][0] as string) as Array<{ name: string }>;
    expect(json.map((p) => p.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('an imported project named like an archived one is a conflict, and the preview counts every project', async () => {
    await mount(undefined, { b: { archived: true } });
    const input = document.getElementById('import-project-file') as HTMLInputElement;
    const file = new File([JSON.stringify([{ ...project('zz', 'Bravo') }])], 'p.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await new Promise((res) => setTimeout(res, 50));
    });
    const preview = screen.getByRole('region', { name: /Import/ });
    expect(within(preview).getByText(/Name conflict/)).toBeTruthy();
    expect(preview.textContent).toContain('Bravo');
  });

  it('a delete with the next tile hidden moves focus to a shown one', async () => {
    await mount(undefined, { b: { archived: true } });
    await click(button('Delete Alpha'));
    await click(screen.getByRole('button', { name: 'Delete' }));
    expect(document.activeElement).toBe(button('Open CFD for Charlie'));
  });

  it('a delete beside an archived tile shown finds its unarchive-and-open name', async () => {
    await mount(undefined, { b: { archived: true } });
    await click(screen.getByLabelText('Show archived (1)'));
    await click(button('Delete Alpha'));
    await click(screen.getByRole('button', { name: 'Delete' }));
    expect(document.activeElement).toBe(button('Unarchive and open CFD for Bravo'));
  });

  it('deleting the last shown project leaves the all-archived line, not the welcome panel', async () => {
    await mount([['a', 'Alpha'], ['b', 'Bravo']], { b: { archived: true } });
    await click(button('Delete Alpha'));
    await click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/All projects are archived/)).toBeTruthy();
  });
});

describe('a failed read of the person\'s settings (O54)', () => {
  function failing(recoverOnRetry = false): StorageDriver {
    const local = createLocalStorageDriver();
    let read: ReturnType<StorageDriver['getProjectPrefs']> = { status: 'failed' };
    const listeners = new Set<(r: typeof read) => void>();
    return {
      ...local,
      getProjectPrefs: () => read,
      onProjectPrefsChange: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      setProjectPref: () => (read.status === 'ready' ? null : 'unread'),
      retryProjectPrefs: vi.fn(() => {
        if (!recoverOnRetry || read.status === 'ready') return;
        read = { status: 'ready', prefs: {} };
        for (const l of listeners) l(read);
      }),
    };
  }

  it('says so in one line; Tile color, Archive and drag are off with the reason; retried when the tab mounts and comes back', async () => {
    h.driver = failing();
    await mount();
    expect(screen.getByText(PREFS_UNREAD_TEXT)).toBeTruthy();
    const archive = button('Archive Alpha') as HTMLButtonElement;
    expect(archive.disabled).toBe(true);
    expect(archive.title).toBe(PREFS_UNREAD_REASON);
    expect((button('Tile color for Alpha: No color') as HTMLButtonElement).disabled).toBe(true);
    expect(tile('a').querySelector('[aria-hidden="true"][title]')?.getAttribute('title')).toBe(PREFS_UNREAD_REASON);
    expect((h.driver as StorageDriver).retryProjectPrefs).toHaveBeenCalled();
  });

  it('a retry that succeeds (here, the browser coming back online) takes the line away and turns the controls on', async () => {
    const d = failing(true);
    let online = false;
    const retry = d.retryProjectPrefs as ReturnType<typeof vi.fn>;
    const succeed = retry.getMockImplementation() as () => void;
    retry.mockImplementation(() => {
      if (online) succeed();
    });
    h.driver = d;
    await mount();
    expect(retry).toHaveBeenCalled(); // the tab's mount: still failing
    expect(screen.getByText(PREFS_UNREAD_TEXT)).toBeTruthy();
    online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(screen.queryByText(PREFS_UNREAD_TEXT)).toBeNull();
    expect((button('Archive Alpha') as HTMLButtonElement).disabled).toBe(false);
  });

  // PR #115 review (Opus-PR115-1 -03): with the list unchanged no snapshot comes at reconnect, and an SDK that
  // went offline while the browser stayed online gets no `online` event. Coming back to the page retries.
  it.each([
    ['the page becoming visible again', () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }],
    ['the window taking focus', () => window.dispatchEvent(new Event('focus'))],
  ])('a retry on %s takes the line away and turns the controls on', async (_name, trigger) => {
    const d = failing(true);
    let back = false;
    const retry = d.retryProjectPrefs as ReturnType<typeof vi.fn>;
    const succeed = retry.getMockImplementation() as () => void;
    retry.mockImplementation(() => {
      if (back) succeed();
    });
    h.driver = d;
    await mount();
    expect(screen.getByText(PREFS_UNREAD_TEXT)).toBeTruthy();
    back = true;
    await act(async () => {
      trigger();
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(screen.queryByText(PREFS_UNREAD_TEXT)).toBeNull();
    expect((button('Archive Alpha') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a page going hidden does not retry', async () => {
    const d = failing();
    h.driver = d;
    await mount();
    const retry = d.retryProjectPrefs as ReturnType<typeof vi.fn>;
    retry.mockClear();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    try {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise((res) => setTimeout(res, 0));
      });
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    }
    expect(retry).not.toHaveBeenCalled();
  });

  it('the line says how to try again, which a trigger keeps', () => {
    expect(PREFS_UNREAD_TEXT).toBe(
      "Your tile colors and archive couldn't be loaded, so Tile color, Archive and drag are off. To try again, switch to another tab or window and back, or reload the page.",
    );
  });

  it('no line while the read is still loading', async () => {
    const d = failing();
    const loading = { status: 'loading' as const };
    h.driver = { ...d, getProjectPrefs: () => loading };
    await mount();
    expect(screen.queryByText(PREFS_UNREAD_TEXT)).toBeNull();
  });
});
