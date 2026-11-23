// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.20.2 (DASH26 R2o; PR #114 review -06): the local driver's last line of
// defence. `moveAmongShown` always returns the index's own ids today, so the
// guard cannot fire through it; it stands against a later change that adds,
// drops or doubles an id, since in local mode the index is the list of projects
// that exist. Tested here by making the move itself return such a list.
import { it, expect, vi, beforeEach } from 'vitest';

const bad = vi.hoisted(() => ({ next: null as string[] | null }));
vi.mock('../order-move', async (original) => {
  const real = await original<typeof import('../order-move')>();
  return { ...real, moveAmongShown: (...args: Parameters<typeof real.moveAmongShown>) => bad.next ?? real.moveAmongShown(...args) };
});

import { createLocalStorageDriver } from '../local-storage-driver';
import { createSampleProject } from '../sample-data';

const index = () => JSON.parse(localStorage.getItem('cfd-lab') ?? '{}').projectIds as string[];

beforeEach(async () => {
  localStorage.clear();
  bad.next = null;
  const d = createLocalStorageDriver();
  for (const id of ['a', 'b', 'c']) await d.createProject({ ...createSampleProject(), id });
});

for (const [what, next] of [['drops an id', ['b', 'a']], ['doubles one', ['b', 'a', 'a']], ['adds one', ['b', 'a', 'c', 'x']]] as const) {
  it(`a move that ${what} is refused, and the index is untouched`, async () => {
    bad.next = [...next];
    const all = ['a', 'b', 'c'];
    expect(await createLocalStorageDriver().moveProject({ draggedId: 'b', targetId: 'a', shownIds: all, heldIds: all })).toEqual({ kind: 'refused' });
    expect(index()).toEqual(['a', 'b', 'c']);
  });
}

it('control: the real move is written', async () => {
  const all = ['a', 'b', 'c'];
  expect(await createLocalStorageDriver().moveProject({ draggedId: 'b', targetId: 'a', shownIds: all, heldIds: all })).toEqual({ kind: 'written', order: ['b', 'a', 'c'] });
});
