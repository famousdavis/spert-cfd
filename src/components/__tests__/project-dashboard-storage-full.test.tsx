// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.19.0 (DASH26 R25, O24, F4): the CFD tab's storage-full alert sits ABOVE the
// bordered panel, outside `main`'s scroll area, so an edit made in the grid
// (usually scrolled below the chart) shows it in view. Dismiss clears it and
// sends focus to the project picker (O25).
// ⚠️ jsdom lays nothing out: these tests pin the DOM ORDER and the column's
// flex-col class (PR #109 review -07), not where the alert renders. What guards
// the layout is the browser measurement (exec-dash-r1b `measure-r1b.mjs`, the
// `full.addRow` alert box above the panel; `cfd-panel-box.mjs`). Without
// flex-col the alert sat BESIDE the panel, 598 px wide, measured by the review.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Project } from '@/types';

const h = vi.hoisted(() => ({
  active: { project: null as Project | null, snapshots: [] as unknown[], storageFull: false, dismissStorageFull: vi.fn() },
}));
vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: () => ({ projects: [{ id: 'a', name: 'Alpha' }], activeProjectId: 'a', switchProject: vi.fn() }),
}));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => h.active }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver: { mode: 'local' } }) }));
vi.mock('../chart/cfd-chart', () => ({ CFDChart: () => <p>chart</p> }));
vi.mock('../grid/data-grid', () => ({ DataGrid: () => <p>grid</p> }));
vi.mock('../workflow/workflow-editor', () => ({ WorkflowEditor: () => null }));
vi.mock('../metrics/metrics-panel', () => ({ MetricsPanel: () => null }));

import { ProjectDashboard } from '../project-dashboard';

const O24 = "This browser's storage is full. Export a project, then delete one to make room.";

beforeEach(() => {
  h.active.project = { id: 'a', name: 'Alpha', createdAt: '', workflow: [], snapshots: [], settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } } };
  h.active.storageFull = false;
  h.active.dismissStorageFull.mockReset();
});

describe('the CFD tab\'s storage-full alert', () => {
  it('is absent while storage is not full', () => {
    render(<ProjectDashboard />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says O24\'s words above the bordered panel, outside main, and Dismiss clears it', () => {
    h.active.storageFull = true;
    render(<ProjectDashboard />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(O24);
    const main = document.querySelector('main')!;
    expect(main.contains(alert)).toBe(false);
    const panel = main.parentElement!;
    expect(alert.nextElementSibling).toBe(panel);
    // The column stacks the alert above the panel only while it is a flex COLUMN.
    expect(panel.parentElement!.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'flex-col']));
    expect(panel.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-0', 'flex-1']));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(h.active.dismissStorageFull).toHaveBeenCalledTimes(1);
  });

  it('O25 (PR #109 review -05): Dismiss sends focus to the project picker, never <body>', () => {
    h.active.storageFull = true;
    render(<ProjectDashboard />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(document.activeElement).toBe(document.getElementById('cfd-project-picker'));
    expect(document.activeElement?.tagName).toBe('SELECT');
  });
});
