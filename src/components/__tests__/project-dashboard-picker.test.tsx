// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R8, R22, O13, D1, O14, O15): the CFD tab names the open
// project with a picker, "Cumulative flow for [project ▾]", above the chart in
// both of its branches. The per-project key sits BELOW the picker, so a switch
// made from it remounts the sidebar, the chart and the grid but not the picker:
// its focus and the browser's type-ahead survive (restoring focus after a
// remount broke type-ahead, measured in the pre-flight).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import type { Project } from '@/types';
import type { ProjectListItem } from '@/lib/storage-driver';

const h = vi.hoisted(() => ({
  list: {
    projects: [] as ProjectListItem[],
    activeProjectId: null as string | null,
    switchProject: vi.fn(),
  },
  active: { project: null as Project | null, snapshots: [] as unknown[] },
  mounts: { chart: 0, grid: 0, side: 0 },
}));

vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => h.list }));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => h.active }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver: { mode: 'local' } }) }));
vi.mock('../chart/cfd-chart', () => ({
  CFDChart: () => {
    useEffect(() => { h.mounts.chart++; }, []);
    return h.active.snapshots.length === 0
      ? <section><div className="border-dashed">Add snapshot data to see the CFD chart</div></section>
      : <section><div aria-label="Cumulative Flow Diagram">plot</div></section>;
  },
}));
vi.mock('../grid/data-grid', () => ({
  DataGrid: () => { useEffect(() => { h.mounts.grid++; }, []); return <p>grid</p>; },
}));
vi.mock('../workflow/workflow-editor', () => ({
  WorkflowEditor: () => { useEffect(() => { h.mounts.side++; }, []); return <p>workflow</p>; },
}));
vi.mock('../metrics/metrics-panel', () => ({ MetricsPanel: () => null }));

import { ProjectDashboard } from '../project-dashboard';

const project = (id: string, name: string): Project => ({
  id, name, createdAt: '', workflow: [], snapshots: [],
  settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
});

beforeEach(() => {
  h.list.projects = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: '' }, { id: 'c', name: 'Gamma' }];
  h.list.activeProjectId = 'a';
  h.list.switchProject.mockReset();
  h.active.project = project('a', 'Alpha');
  h.active.snapshots = [];
  h.mounts = { chart: 0, grid: 0, side: 0 };
});

const picker = () => screen.getByRole('combobox', { name: 'Cumulative flow for' }) as HTMLSelectElement;

describe('the picker', () => {
  it('names the open project, in a 16 px heading row above the chart, and lists every project', () => {
    render(<ProjectDashboard />);
    const row = screen.getByRole('heading', { level: 2, name: /^Cumulative flow for/ });
    expect(row.className).toContain('text-base');
    expect(picker().value).toBe('a');
    expect([...picker().options].map((o) => o.text)).toEqual(['Alpha', 'Untitled project', 'Gamma']);
    // Above the chart, inside the scroll area, in both branches.
    const main = screen.getByRole('main');
    expect(main.firstElementChild).toBe(row);
    expect(screen.queryByText('Cumulative Flow Diagram')).toBeNull();
    expect(screen.queryByText('Chart')).toBeNull();
  });

  it('also heads a project with snapshots', () => {
    h.active.snapshots = [{}];
    render(<ProjectDashboard />);
    expect(screen.getByRole('main').firstElementChild?.textContent).toMatch(/^Cumulative flow for/);
    expect(document.querySelector('[aria-label="Cumulative Flow Diagram"]')).toBeTruthy();
  });

  it('a change switches the open project', () => {
    render(<ProjectDashboard />);
    fireEvent.change(picker(), { target: { value: 'c' } });
    expect(h.list.switchProject).toHaveBeenCalledWith('c');
  });

  it('stays mounted and focused across a switch, while the sidebar, chart and grid remount', () => {
    const view = render(<ProjectDashboard />);
    const select = picker();
    select.focus();
    expect(h.mounts).toEqual({ chart: 1, grid: 1, side: 1 });
    // The switch: the list names the new project at once; the old project's data
    // is still loaded (active-project-context keeps it until the load resolves).
    h.list.activeProjectId = 'c';
    view.rerender(<ProjectDashboard />);
    expect(picker()).toBe(select);
    expect(document.activeElement).toBe(select);
    expect(select.value).toBe('c');
    expect(h.mounts).toEqual({ chart: 2, grid: 2, side: 2 });
  });

  it('a switch shows the new project from the top of the scroll area', () => {
    const view = render(<ProjectDashboard />);
    const main = screen.getByRole('main');
    main.scrollTop = 120;
    h.list.activeProjectId = 'c';
    view.rerender(<ProjectDashboard />);
    expect(main.scrollTop).toBe(0);
  });

  it('with projects but none open: a "Choose a project" placeholder above today\'s empty state (O15)', () => {
    h.list.activeProjectId = null;
    h.active.project = null;
    render(<ProjectDashboard onGoToProjects={vi.fn()} />);
    expect(picker().value).toBe('');
    expect(picker().options[0].text).toBe('Choose a project');
    expect(picker().options[0].disabled).toBe(true);
    expect(screen.getByText('Open a project from the Projects tab to view its CFD.')).toBeTruthy();
  });

  it('stays the same element when the first project opens', () => {
    h.list.activeProjectId = null;
    h.active.project = null;
    const view = render(<ProjectDashboard />);
    const select = picker();
    select.focus();
    h.list.activeProjectId = 'a';
    h.active.project = project('a', 'Alpha');
    view.rerender(<ProjectDashboard />);
    expect(picker()).toBe(select);
    expect(document.activeElement).toBe(select);
  });

  it('with no projects at all: no picker', () => {
    h.list.projects = [];
    h.list.activeProjectId = null;
    h.active.project = null;
    render(<ProjectDashboard />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('takes focus as it mounts when asked once (a tile\'s Open, O14), and not otherwise', () => {
    const take = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    render(<ProjectDashboard takePickerFocus={take} />);
    expect(document.activeElement).toBe(picker());
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('does not take focus when not asked (the CFD tab button)', () => {
    render(<ProjectDashboard takePickerFocus={() => false} />);
    expect(document.activeElement).not.toBe(picker());
  });

  it('its select passes form hygiene: an id, a name and a <label>', () => {
    render(<ProjectDashboard />);
    const select = picker();
    expect(select.id).toBe('cfd-project-picker');
    expect(select.name).toBe('cfdProject');
    expect(document.querySelector(`label[for="${select.id}"]`)?.textContent).toBe('Cumulative flow for');
  });
});
