// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.19.0 (DASH26 O21, F6): the welcome panel and the pending line with the
// REAL ProjectListProvider, under a storage context whose driver changes.
// - No frame of the welcome panel across a swap to a cloud driver: an empty
//   local list (the first visit's state since R20) swapped to Cloud, as an
//   invitee's sign-in does (R26). Each commit's DOM is RECORDED by a layout
//   effect, which runs after the commit and before the effects that follow
//   it. A check after act() cannot fail here: act() runs the effect that
//   hides the panel, so the one-frame panel is gone by then. (A
//   MutationObserver alone records one removal of the panel either way and
//   cannot tell which commit it fell in.)
// - The pending line while the cloud list loads, and after a failed load; an
//   own create then clears it (the list listener never delivers it, M1).
// - Cloud: an empty list is never seeded.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useLayoutEffect, type ReactNode } from 'react';
import type { StorageDriver } from '@/lib/storage-driver';

const h = vi.hoisted(() => ({ driver: null as unknown }));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver: h.driver, mode: (h.driver as { mode: string }).mode }),
}));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => ({ project: null }) }));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));

import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context';
import { ProjectsTab, CLOUD_PENDING_TEXT } from '../projects-tab';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';

const WELCOME = 'Welcome to SPERT® CFD';

function cloudDriver(over: Partial<StorageDriver> = {}): StorageDriver {
  return {
    ...createLocalStorageDriver(),
    mode: 'cloud',
    workspaceId: 'uid-me',
    loadProjectList: () => new Promise(() => {}), // never settles: a load in flight
    createProject: async () => {},
    onProjectListChange: () => () => {},
    onProjectChange: () => () => {},
    ...over,
  } as StorageDriver;
}

/** Records, after every commit, which driver was in use and whether the panel was on screen. */
const commits: Array<{ mode: string; panel: boolean; pending: boolean }> = [];
function Recorder({ children }: { children: ReactNode }) {
  const { driverLoading } = useProjectList();
  useLayoutEffect(() => {
    commits.push({
      mode: (h.driver as StorageDriver).mode,
      panel: screen.queryByRole('region', { name: WELCOME }) !== null,
      pending: screen.queryByText(CLOUD_PENDING_TEXT) !== null,
    });
  });
  return <>{children}{String(driverLoading)}</>;
}

const tree = () => (
  <ProjectListProvider>
    <Recorder>
      <ProjectsTab onOpenInCfd={vi.fn()} />
    </Recorder>
  </ProjectListProvider>
);

beforeEach(() => {
  localStorage.clear();
  commits.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the welcome panel never shows for a frame across a swap to cloud (F6)', () => {
  it('an empty local list swapped to a cloud driver: no commit shows the panel under the cloud driver', async () => {
    h.driver = createLocalStorageDriver();
    const view = render(tree());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('region', { name: WELCOME })).toBeTruthy(); // local, loaded, empty: the panel

    h.driver = cloudDriver();
    await act(async () => { view.rerender(tree()); });
    const cloudCommits = commits.filter((c) => c.mode === 'cloud');
    expect(cloudCommits.length).toBeGreaterThan(0);
    expect(cloudCommits.filter((c) => c.panel)).toEqual([]);
    expect(cloudCommits.every((c) => c.pending)).toBe(true);
  });
});

describe('the pending line (O21)', () => {
  it('a failed first cloud load keeps the pending line, no panel; an own create then clears it', async () => {
    const held: { create?: (name: string) => Promise<string> } = {};
    const keep = (fn: (name: string) => Promise<string>) => { held.create = fn; };
    function Grab({ onReady }: { onReady: typeof keep }) {
      const { createProject } = useProjectList();
      useLayoutEffect(() => onReady(createProject));
      return null;
    }
    h.driver = cloudDriver({ loadProjectList: async () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); } });
    render(<ProjectListProvider><Grab onReady={keep} /><ProjectsTab onOpenInCfd={vi.fn()} /></ProjectListProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByText(CLOUD_PENDING_TEXT)).toBeTruthy();
    expect(screen.queryByRole('region', { name: WELCOME })).toBeNull();
    await act(async () => { await held.create!('Mine'); });
    expect(screen.queryByText(CLOUD_PENDING_TEXT)).toBeNull();
    expect(screen.queryByRole('region', { name: WELCOME })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open CFD for Mine' })).toBeTruthy();
  });

  it('a cloud load that delivers nothing: the panel, and nothing seeded', async () => {
    const createProject = vi.fn(async () => {});
    h.driver = cloudDriver({ loadProjectList: async () => [], createProject });
    render(tree());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByRole('region', { name: WELCOME })).toBeTruthy();
    expect(screen.queryByText(CLOUD_PENDING_TEXT)).toBeNull();
    expect(createProject).not.toHaveBeenCalled();
  });
});
