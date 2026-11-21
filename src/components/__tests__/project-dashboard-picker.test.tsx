// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R8, R22, O13, D1, O14, O15): the CFD tab names the open
// project with a picker, "Cumulative flow for [project ▾]", above the chart in
// both of its branches. The per-project key sits BELOW the picker, so a switch
// made from it remounts the sidebar, the chart and the grid but not the picker:
// its focus and the browser's type-ahead survive (restoring focus after a
// remount broke type-ahead, measured in the pre-flight). The key is the LOADED
// project's id: keyed by the list's id, a fresh boundary rendered the previous
// project first and kept its crash (PR #108 review, -01). That the old labels
// are gone from the real chart is pinned in cfd-chart-label.test.tsx; here the
// chart is a stand-in.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    // A chart that crashes on one project's data (DASH26 PR #108 review, -01).
    if (h.active.project?.id === 'bad') throw new Error('this project\'s data breaks the chart');
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

afterEach(() => vi.restoreAllMocks());

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
    // Above the chart, inside the scroll area.
    const main = screen.getByRole('main');
    expect(main.firstElementChild).toBe(row);
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

  it('stays mounted and focused across a switch; the sidebar, chart and grid remount once the new project has loaded', () => {
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
    expect(h.mounts).toEqual({ chart: 1, grid: 1, side: 1 });
    // The new project has loaded: a fresh sidebar, chart and grid for it.
    h.active.project = project('c', 'Gamma');
    view.rerender(<ProjectDashboard />);
    expect(picker()).toBe(select);
    expect(document.activeElement).toBe(select);
    expect(h.mounts).toEqual({ chart: 2, grid: 2, side: 2 });
  });

  it('a chart crash shows its notice inside the panel, under a picker that still works', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.list.projects = [{ id: 'bad', name: 'Bad chart' }, { id: 'c', name: 'Gamma' }];
    h.list.activeProjectId = 'bad';
    h.active.project = project('bad', 'Bad chart');
    render(<ProjectDashboard />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('alert').textContent).toContain('This view could not be displayed.');
    expect(main.firstElementChild).toBe(screen.getByRole('heading', { level: 2, name: /^Cumulative flow for/ }));
    expect(screen.getByText('workflow')).toBeTruthy();
    fireEvent.change(picker(), { target: { value: 'c' } });
    expect(h.list.switchProject).toHaveBeenCalledWith('c');
  });

  it('after a chart crash, the next project to load gets a fresh chart: the key is the loaded project', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.list.projects = [{ id: 'bad', name: 'Bad chart' }, { id: 'c', name: 'Gamma' }];
    h.list.activeProjectId = 'bad';
    h.active.project = project('bad', 'Bad chart');
    const view = render(<ProjectDashboard />);
    expect(screen.getByRole('alert')).toBeTruthy();
    // Picked from the picker: the list switches at once, the old (crashing) project is still loaded.
    h.list.activeProjectId = 'c';
    view.rerender(<ProjectDashboard />);
    // Then the good project arrives.
    h.active.project = project('c', 'Gamma');
    view.rerender(<ProjectDashboard />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Add snapshot data to see the CFD chart')).toBeTruthy();
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

  // The pairs the browser relies on (jsdom loads no CSS; P4 measured them live).
  it('keeps a visible focus ring and one unwrapped row whose select can shrink', () => {
    render(<ProjectDashboard />);
    const cls = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);
    const select = picker();
    expect(cls(select)).toEqual(expect.arrayContaining(['focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-[#0070f3]']));
    expect(cls(select)).not.toContain('outline-none');
    expect(cls(select)).not.toContain('focus-visible:outline-none');
    expect(cls(select)).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full', 'overflow-hidden', 'text-ellipsis', 'whitespace-nowrap']));
    const row = select.closest('h2')!;
    expect(cls(row)).toEqual(expect.arrayContaining(['flex', 'min-w-0', 'whitespace-nowrap', 'text-base', 'leading-6']));
    expect(cls(row)).not.toContain('flex-wrap');
  });

  it('its select passes form hygiene: an id, a name and a <label>', () => {
    render(<ProjectDashboard />);
    const select = picker();
    expect(select.id).toBe('cfd-project-picker');
    expect(select.name).toBe('cfdProject');
    expect(document.querySelector(`label[for="${select.id}"]`)?.textContent).toBe('Cumulative flow for');
  });
});
