// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// The metrics panel must name the period it actually computes on, and must say
// when a Done count went down. Both were invisible: the select showed "All
// data" above a range or an unoffered days window, and a falling Done read as
// zero throughput without a word.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { MetricsPeriod, Snapshot, WorkflowState } from '@/types';

const mock = vi.hoisted(() => ({ ctx: {} as Record<string, unknown> }));
vi.mock('@/contexts/active-project-context', () => ({
  useActiveProject: () => mock.ctx,
}));

import { MetricsPanel } from '../metrics/metrics-panel';

const workflow: WorkflowState[] = [
  { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
  { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
  { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
];

function snap(date: string, dev: number, done: number): Snapshot {
  return { date, counts: { backlog: 0, dev, done } };
}

const cumulative = [snap('2026-03-01', 3, 0), snap('2026-03-08', 4, 7), snap('2026-03-15', 5, 14)];

function renderPanel(snapshots: Snapshot[], metricsPeriod: MetricsPeriod) {
  mock.ctx = {
    workflow,
    snapshots,
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod },
    updateSettings: vi.fn(),
  };
  render(<MetricsPanel />);
  return screen.getByRole('combobox', { name: 'Metrics period' }) as HTMLSelectElement;
}

function cardValue(label: string): string | null | undefined {
  return screen.getByText(label).nextElementSibling?.textContent;
}

afterEach(cleanup);

describe('MetricsPanel — a Done count that goes down', () => {
  it('warns, naming the first pair of dates where Done fell', () => {
    renderPanel(
      [snap('2026-02-01', 2, 12), snap('2026-02-02', 2, 20), snap('2026-02-03', 2, 3)],
      { kind: 'all' },
    );
    expect(screen.getByText('Done count went down')).toBeTruthy();
    expect(screen.getByText(/Between Feb 2, 2026 and Feb 3, 2026\./)).toBeTruthy();
  });

  it('shows no warning when Done is cumulative', () => {
    renderPanel(cumulative, { kind: 'all' });
    expect(cardValue('Lead Time')).not.toBeUndefined(); // control: the panel rendered
    expect(screen.queryByText('Done count went down')).toBeNull();
  });
});

describe('MetricsPanel — the period it shows is the period it uses', () => {
  it('names a valid custom range instead of claiming "All data"', () => {
    const select = renderPanel(cumulative, { kind: 'range', start: '2026-03-01', end: '2026-03-15' });
    expect(select.value).toBe('range');
    expect(select.selectedOptions[0].textContent).toBe('Custom: Mar 1 – Mar 15, 2026');
    expect(select.selectedOptions[0].disabled).toBe(true);
  });

  it('names a valid days window the selector does not offer', () => {
    const select = renderPanel(cumulative, { kind: 'days', value: 60 });
    expect(select.selectedOptions[0].textContent).toBe('Last 60 days');
  });

  it('shows "All data" for a malformed period, and computes on all data', () => {
    const select = renderPanel(cumulative, { kind: 'days' } as unknown as MetricsPeriod);
    expect(select.selectedOptions[0].textContent).toBe('All data');
    expect(cardValue('WIP')).toBe('5');
    expect(cardValue('Throughput')).toBe('1.0/d');
  });
});
