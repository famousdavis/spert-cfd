// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R1a): one project's tile, SPERT® Forecaster's anatomy.
// Replaces project-row-unnamed.test.tsx (its placeholder intent kept below) and
// project-row-updated-at.test.tsx ("Updated" left the tile, R7; the meta lines
// are pinned in src/lib/__tests__/project-tile-meta.test.ts).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectTile, type ProjectTileProps } from '../project-row';
import { tileAccess, OWNER_ONLY_DELETE_REASON, VIEW_ONLY_REASON } from '@/lib/tile-access';

function renderTile(over: Partial<ProjectTileProps> = {}) {
  const props: ProjectTileProps = {
    id: 'p1',
    name: 'Alpha',
    stats: { snapshotCount: 14, workflowStateCount: 5, lastSnapshotDate: '2026-06-18' },
    access: tileAccess('local', undefined, undefined),
    onOpen: vi.fn(),
    onExport: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onShare: vi.fn(),
    onClone: vi.fn(),
    ...over,
  };
  render(<ul><ProjectTile {...props} /></ul>);
  return props;
}

describe('the tile', () => {
  it('is a list item named by its project, whose name opens the CFD tab', () => {
    const props = renderTile();
    const tile = document.querySelector('li[data-tile="true"]') as HTMLElement;
    expect(tile.dataset.projectId).toBe('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Open CFD for Alpha' }));
    expect(props.onOpen).toHaveBeenCalledWith('p1');
  });

  it('shows the meta lines (R7)', () => {
    renderTile();
    expect(screen.getByText('14 snapshots · 5 states')).toBeTruthy();
    expect(screen.getByText('Last snapshot Jun 18, 2026')).toBeTruthy();
    expect(screen.queryByText(/^Updated/)).toBeNull();
  });

  it('shows a placeholder for an empty name, and every action still names it', () => {
    renderTile({ name: '' });
    expect(screen.getByText('Untitled project')).toBeTruthy();
    for (const name of ['Open CFD for Untitled project', 'Delete Untitled project', 'Export Untitled project', 'Edit Untitled project', 'Clone Untitled project']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('Delete, Export and Edit each carry the project\'s name and call with its id', () => {
    const props = renderTile();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }));
    expect(props.onDelete).toHaveBeenCalledWith('p1');
    expect(props.onExport).toHaveBeenCalledWith('p1');
    expect(props.onEdit).toHaveBeenCalledWith('p1');
  });

  it('has no "sortable" wrapper: its only tab stops are its buttons, and the grip is hidden', () => {
    renderTile();
    const tile = document.querySelector('li[data-tile="true"]') as HTMLElement;
    const stops = [...tile.querySelectorAll<HTMLElement>('*')].filter((el) => el.tabIndex >= 0);
    expect(stops.every((el) => el.tagName === 'BUTTON')).toBe(true);
    expect(stops.map((b) => b.getAttribute('aria-label'))).toEqual(['Open CFD for Alpha', 'Delete Alpha', 'Export Alpha', 'Edit Alpha', 'Clone Alpha']);
    expect(tile.querySelector('[role="button"]')).toBeNull();
    expect(tile.hasAttribute('tabindex')).toBe(false);
    expect(tile.querySelector('[title="Drag to reorder"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('local mode: no badge, no Share, Delete and Edit enabled', () => {
    renderTile();
    expect(screen.queryByText('Shared')).toBeNull();
    expect(screen.queryByText('View only')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Share / })).toBeNull();
    expect((screen.getByRole('button', { name: 'Delete Alpha' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Edit Alpha' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a cloud owner of a shared project: Share, and "Shared" in the open button\'s name', () => {
    const props = renderTile({ access: tileAccess('cloud', 'owner', 2) });
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open CFD for Alpha (Shared)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Share Alpha' }));
    expect(props.onShare).toHaveBeenCalledWith('p1');
  });

  it('a cloud editor: Delete disabled, its reason in title and in described-by text', () => {
    renderTile({ access: tileAccess('cloud', 'editor', 2) });
    const del = screen.getByRole('button', { name: 'Delete Alpha' }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(del.title).toBe(OWNER_ONLY_DELETE_REASON);
    expect(document.getElementById(del.getAttribute('aria-describedby')!)?.textContent).toBe(OWNER_ONLY_DELETE_REASON);
    expect((screen.getByRole('button', { name: 'Edit Alpha' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a cloud viewer: "View only" alone; Delete and Edit disabled with their reasons', () => {
    renderTile({ access: tileAccess('cloud', 'viewer', 3) });
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.queryByText('Shared')).toBeNull();
    const edit = screen.getByRole('button', { name: 'Edit Alpha' }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
    expect(edit.title).toBe(VIEW_ONLY_REASON);
    expect(document.getElementById(edit.getAttribute('aria-describedby')!)?.textContent).toBe(VIEW_ONLY_REASON);
    expect((screen.getByRole('button', { name: 'Delete Alpha' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Clone (v0.19.0, DASH26 R1b)', () => {
  it('comes last in the revealed row, after Edit, named for its project and titled "Clone project"; it calls with the id', () => {
    const props = renderTile();
    const row = screen.getByRole('button', { name: 'Edit Alpha' }).parentElement as HTMLElement;
    expect([...row.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Export Alpha', 'Edit Alpha', 'Clone Alpha']);
    const clone = screen.getByRole('button', { name: 'Clone Alpha' }) as HTMLButtonElement;
    expect(clone.title).toBe('Clone project');
    fireEvent.click(clone);
    expect(props.onClone).toHaveBeenCalledWith('p1');
  });

  it.each(['owner', 'editor', 'viewer'] as const)('is offered and enabled for a cloud %s (O9)', (role) => {
    renderTile({ access: tileAccess('cloud', role, 2) });
    expect((screen.getByRole('button', { name: 'Clone Alpha' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
