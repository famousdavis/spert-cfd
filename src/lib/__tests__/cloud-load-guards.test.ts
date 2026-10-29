// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// cloud-load-guards (v0.16.4) — what the checks on cloud-read project data set
// aside, and, as importantly, that nothing the app itself writes is ever set
// aside: saveProject writes name, workflow, snapshots and settings back whole,
// so a check stricter than the app's writers would drop real data at the next
// edit.

import { describe, it, expect, vi } from 'vitest';
import {
  cloudText,
  cloudWorkflow,
  cloudSnapshots,
  cloudSettings,
  cloudProjectData,
  DEFAULT_SETTINGS,
  FALLBACK_STATE_COLOR,
} from '../cloud-load-guards';
import { createSampleProject } from '../sample-data';
import { applyCSVImport, parseCSV } from '../csv';
import { validateProjectData } from '../storage';
import { MAX_NAME_LENGTH } from '../constants';
import type { Project, WorkflowState } from '@/types';

describe('what the app writes loads unchanged, with nothing set aside', () => {
  function expectUnchanged(project: Pick<Project, 'name' | 'workflow' | 'snapshots' | 'settings'>) {
    const report = vi.fn();
    // A Firestore round trip: what the app wrote, as plain data.
    const stored = JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
    expect(cloudProjectData('p1', stored, report)).toStrictEqual({
      name: project.name,
      workflow: project.workflow,
      snapshots: project.snapshots,
      settings: project.settings,
    });
    expect(report).not.toHaveBeenCalled();
  }

  it('the sample project', () => {
    expectUnchanged(createSampleProject());
  });

  it('the largest project the writers allow: 200-character names, every field, and just under 1 MiB of snapshots', () => {
    const workflow: WorkflowState[] = Array.from({ length: 24 }, (_, i) => ({
      id: `state-${i}`,
      name: `${i} ${'N'.repeat(MAX_NAME_LENGTH)}`.slice(0, MAX_NAME_LENGTH),
      color: i % 2 ? '#64748B' : '#22c55e',
      category: (['backlog', 'active', 'done'] as const)[i % 3],
      order: i,
      ...(i % 3 === 1 ? { wipLimit: 1 + i } : {}),
    }));
    const counts = Object.fromEntries(workflow.map((s, i) => [s.id, 100_000 + i]));
    const snapshots = Array.from({ length: 2250 }, (_, i) => ({
      date: new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10),
      counts,
    }));
    const project = {
      name: 'P'.repeat(MAX_NAME_LENGTH),
      workflow,
      snapshots,
      settings: { gridSortNewestFirst: false, showWipWarnings: false, metricsPeriod: { kind: 'range' as const, start: '2000-01-01', end: '2006-02-28' } },
    };
    const size = JSON.stringify(project).length;
    expect(size).toBeGreaterThan(1_000_000);
    expect(size).toBeLessThan(1024 * 1024);
    expect(validateProjectData({ ...project, createdAt: '2026-01-01T00:00:00.000Z' })).toBe(true);
    expectUnchanged(project);
  });

  it('every metrics period the settings write, and settings with no period yet', () => {
    for (const metricsPeriod of [{ kind: 'all' }, { kind: 'days', value: 30 }, { kind: 'range', start: '2026-01-01', end: '2026-06-30' }] as const) {
      expectUnchanged({ ...createSampleProject(), settings: { ...DEFAULT_SETTINGS, metricsPeriod } });
    }
    const report = vi.fn();
    expect(cloudSettings({ gridSortNewestFirst: false }, 'p1', report)).toStrictEqual({ ...DEFAULT_SETTINGS, gridSortNewestFirst: false });
    expect(report).not.toHaveBeenCalled();
  });

  it('every date the date input and CSV import write, leap days included', () => {
    const report = vi.fn();
    const dates = ['0001-01-01', '1999-12-31', '2024-02-29', '2026-10-29', '9999-12-31'];
    const parsed = parseCSV('Date,Backlog\n10/29/2026,3\n2026-02-28,4\n');
    const imported = applyCSVImport(parsed, ['date', 'backlog'], [], ['backlog']).snapshots;
    const snapshots = [...dates.map((date) => ({ date, counts: { backlog: 0 } })), ...imported];
    expect(cloudSnapshots(snapshots, 'p1', report)).toStrictEqual(snapshots);
    expect(report).not.toHaveBeenCalled();
  });

  it('a state with no WIP limit, however the editor cleared it', () => {
    const report = vi.fn();
    const state = { id: 's', name: 'S', color: '#123456', category: 'active', order: 0 };
    expect(cloudWorkflow([state, { ...state, id: 't', wipLimit: null }], 'p1', report)).toStrictEqual([state, { ...state, id: 't' }]);
    expect(report).not.toHaveBeenCalled();
  });
});

describe('cloudText', () => {
  it('keeps text as written, any length, and reads absent as empty silently', () => {
    const report = vi.fn();
    expect(cloudText('x'.repeat(5000), 'p1', 'project-name', report)).toHaveLength(5000);
    expect(cloudText(undefined, 'p1', 'project-name', report)).toBe('');
    expect(report).not.toHaveBeenCalled();
  });

  it.each([[{ evil: 1 }], [['a']], [42], [true]])('reads %j as empty text and reports the rule', (value) => {
    const report = vi.fn();
    expect(cloudText(value, 'p1', 'project-name', report)).toBe('');
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'project-name');
  });
});

describe('cloudWorkflow', () => {
  const good = { id: 's1', name: 'Doing', color: '#123456', category: 'active', order: 0, wipLimit: 3 };

  it('sets aside a state it cannot read and keeps the others', () => {
    const report = vi.fn();
    const result = cloudWorkflow([
      good,
      null,
      'state',
      { ...good, id: 7 },
      { ...good, name: { text: 'x' } },
      { ...good, category: 'blocked' },
      { ...good, id: 's2' },
    ], 'p1', report);
    expect(result.map((s) => s.id)).toStrictEqual(['s1', 's2']);
    expect(report).toHaveBeenCalledTimes(5);
    expect(report).toHaveBeenCalledWith('p1', 'workflow-state');
  });

  it('replaces a color, order or WIP limit it cannot use, and keeps the state', () => {
    const report = vi.fn();
    const [state] = cloudWorkflow([{ ...good, color: 'red', order: 'first', wipLimit: -1 }], 'p1', report);
    expect(state).toStrictEqual({ id: 's1', name: 'Doing', color: FALLBACK_STATE_COLOR, category: 'active', order: 0 });
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'workflow-state');
  });

  it('reads a workflow that is not a list as none', () => {
    const report = vi.fn();
    expect(cloudWorkflow({ 0: good }, 'p1', report)).toStrictEqual([]);
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'workflow');
    expect(cloudWorkflow(undefined, 'p1')).toStrictEqual([]);
  });
});

describe('cloudSnapshots', () => {
  it('sets aside a snapshot whose date or counts cannot be read, and keeps the others', () => {
    const report = vi.fn();
    const result = cloudSnapshots([
      { date: '2026-01-01', counts: { s1: 1 } },
      null,
      { date: 20260102, counts: {} },
      { date: '100000-01-01', counts: {} },
      { date: '2026/01/04', counts: {} },
      { date: '2026-01-05', counts: [1, 2] },
      { date: '2026-01-06', counts: 'many' },
      { date: '2026-01-07', counts: { s1: 7 } },
    ], 'p1', report);
    expect(result.map((s) => s.date)).toStrictEqual(['2026-01-01', '2026-01-07']);
    expect(report).toHaveBeenCalledTimes(6);
    expect(report).toHaveBeenCalledWith('p1', 'snapshot');
  });

  it('leaves out a count that is not a finite number, which the chart then reads as 0', () => {
    const report = vi.fn();
    const result = cloudSnapshots([{ date: '2026-01-01', counts: { a: 1, b: 'x', c: Infinity, d: null, e: 0 } }], 'p1', report);
    expect(result).toStrictEqual([{ date: '2026-01-01', counts: { a: 1, e: 0 } }]);
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'snapshot-count');
  });

  it('keeps a YYYY-MM-DD that is not a calendar date: JSON import accepts it, and formatDate shows it as is', () => {
    const report = vi.fn();
    expect(cloudSnapshots([{ date: '2026-02-30', counts: {} }], 'p1', report)).toHaveLength(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('reads snapshots that are not a list as none', () => {
    const report = vi.fn();
    expect(cloudSnapshots('2026-01-01', 'p1', report)).toStrictEqual([]);
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'snapshots');
  });
});

describe('cloudSettings', () => {
  it('replaces each field of the wrong type with its default and reports it', () => {
    const report = vi.fn();
    expect(cloudSettings({ gridSortNewestFirst: 'yes', showWipWarnings: false, metricsPeriod: 'all' }, 'p1', report))
      .toStrictEqual({ gridSortNewestFirst: true, showWipWarnings: false, metricsPeriod: { kind: 'all' } });
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('reads settings that are not an object as the defaults', () => {
    const report = vi.fn();
    expect(cloudSettings(['x'], 'p1', report)).toStrictEqual(DEFAULT_SETTINGS);
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'settings');
    expect(cloudSettings(null, 'p1')).toStrictEqual(DEFAULT_SETTINGS);
  });
});

describe('cloudProjectData', () => {
  it('never throws, whatever the document holds', () => {
    for (const value of [null, 1, 'x', [], { name: Symbol.iterator }, { workflow: [{ id: 's', name: 'n', category: 'done', order: {} }] }]) {
      expect(() => cloudProjectData('p1', value as Record<string, unknown>)).not.toThrow();
    }
  });
});
