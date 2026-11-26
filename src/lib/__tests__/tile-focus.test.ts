// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 O12): after a delete, focus goes to the next tile, else the
// previous, else New Project. Since v0.19.0 the last project may be deleted
// (R10), so the third branch happens on every delete of the last tile (measured
// in the browser; projects-tab-tiles.test.tsx pins it through the tab).

import { describe, it, expect } from 'vitest';
import { findTileControl, focusAfterTileLeaves, resolveFocusTarget } from '../tile-focus';

const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('focusAfterTileLeaves', () => {
  it('the next tile', () => expect(focusAfterTileLeaves(list, 'b')).toEqual({ kind: 'open', projectId: 'c' }));
  it('the previous tile, when the last one leaves', () => expect(focusAfterTileLeaves(list, 'c')).toEqual({ kind: 'open', projectId: 'b' }));
  it('New Project, when the only one leaves', () => expect(focusAfterTileLeaves([{ id: 'a' }], 'a')).toEqual({ kind: 'new' }));
  it('New Project, for an id not shown', () => expect(focusAfterTileLeaves(list, 'zz')).toEqual({ kind: 'new' }));
});

describe('findTileControl / resolveFocusTarget', () => {
  function grid() {
    const root = document.createElement('div');
    // An id and a name holding characters a CSS selector would choke on.
    root.innerHTML = `
      <li data-tile="true" data-project-id='p"1'>
        <button aria-label='Open CFD for A "quoted" \\ name'></button>
        <button aria-label='Delete A "quoted" \\ name'></button>
        <button aria-label='Edit A "quoted" \\ name'></button>
      </li>
      <li data-tile="true" data-project-id="p2"><button aria-label="Open CFD for B"></button></li>`;
    return root;
  }

  it('finds each control by the tile\'s id and the control\'s name, as text', () => {
    const root = grid();
    expect(findTileControl(root, 'p"1', 'open')?.getAttribute('aria-label')).toBe('Open CFD for A "quoted" \\ name');
    expect(findTileControl(root, 'p"1', 'delete')?.getAttribute('aria-label')).toBe('Delete A "quoted" \\ name');
    expect(findTileControl(root, 'p"1', 'edit')?.getAttribute('aria-label')).toBe('Edit A "quoted" \\ name');
    expect(findTileControl(root, 'p2', 'open')?.getAttribute('aria-label')).toBe('Open CFD for B');
    expect(findTileControl(root, 'p2', 'delete')).toBeNull();
    expect(findTileControl(root, 'gone', 'open')).toBeNull();
  });

  it('resolves "new" to New Project and a tile target to its control', () => {
    const root = grid();
    const newProject = document.createElement('button');
    expect(resolveFocusTarget(root, { kind: 'new' }, newProject)).toBe(newProject);
    expect(resolveFocusTarget(root, { kind: 'open', projectId: 'p2' }, newProject)?.getAttribute('aria-label')).toBe('Open CFD for B');
  });

  // v0.21.0 (PR #115 review, Opus-PR115-2 -11): a project named "and open CFD for …" gives its Unarchive the name
  // "Unarchive and open CFD for …", which starts like an archived tile's name button. The name button comes first.
  it('finds Unarchive on a tile whose project name starts "and open CFD for"', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <li data-tile="true" data-project-id="q">
        <h3><button aria-label="Unarchive and open CFD for and open CFD for Q"></button></h3>
        <button aria-label="Delete and open CFD for Q"></button>
        <button aria-label="Unarchive and open CFD for Q"></button>
      </li>
      <li data-tile="true" data-project-id="b">
        <h3><button aria-label="Unarchive and open CFD for Bravo"></button></h3>
        <button aria-label="Unarchive Bravo"></button>
      </li>
      <li data-tile="true" data-project-id="c"><h3><button aria-label="Open CFD for Charlie"></button></h3></li>`;
    expect(findTileControl(root, 'q', 'unarchive')?.getAttribute('aria-label')).toBe('Unarchive and open CFD for Q');
    expect(findTileControl(root, 'q', 'open')?.getAttribute('aria-label')).toBe('Unarchive and open CFD for and open CFD for Q');
    expect(findTileControl(root, 'b', 'unarchive')?.getAttribute('aria-label')).toBe('Unarchive Bravo');
    expect(findTileControl(root, 'b', 'open')?.getAttribute('aria-label')).toBe('Unarchive and open CFD for Bravo');
    expect(findTileControl(root, 'c', 'unarchive')).toBeNull();
  });
});
