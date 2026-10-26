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

function snap(date: string, dev: number, done: number, backlog = 0): Snapshot {
  return { date, counts: { backlog, dev, done } };
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

// ── Cycle Time and Lead Time, and when they can be trusted ──

const CYCLE_SLOW = 'Work is finishing faster than it starts — Cycle Time will overstate how long new work takes.';
const CYCLE_FAST = 'Work is starting faster than it finishes — Cycle Time will understate how long new work takes.';
const LEAD_SLOW = 'Requests are finishing faster than new ones arrive — Lead Time will overstate how long new requests take.';
const LEAD_FAST = 'Requests are arriving faster than they finish — Lead Time will understate how long new requests take.';
const REMOVED = /Items were removed without being done/;

/**
 * Ten days from backlog 1000, In Dev 200, Done 0, so each rate is its growth
 * ÷ 10; counts in the hundreds clear the noise test, so 20 % decides
 */
function tenDaysTo(backlog: number, dev: number, done: number): Snapshot[] {
  return [snap('2026-03-01', 200, 0, 1000), snap('2026-03-11', dev, done, backlog)];
}

function warningShown(text: string | RegExp): boolean {
  return screen.queryByText(text) !== null;
}

describe('MetricsPanel — six cards', () => {
  it('shows WIP, Throughput, Start Rate, Arrival Rate, Cycle Time and Lead Time', () => {
    // Steady: 2 arrive, 2 start and 2 finish a day; 10 wait, 4 in progress.
    renderPanel(
      [snap('2026-03-01', 4, 0, 10), snap('2026-03-02', 4, 2, 10), snap('2026-03-03', 4, 4, 10)],
      { kind: 'all' },
    );
    expect(cardValue('WIP')).toBe('4');
    expect(cardValue('Throughput')).toBe('2.0/d');
    expect(cardValue('Start Rate')).toBe('2.0/d');
    expect(cardValue('Arrival Rate')).toBe('2.0/d');
    expect(cardValue('Cycle Time')).toBe('2.0d');
    expect(cardValue('Lead Time')).toBe('7.0d');
    expect(screen.queryByText('Flow is not steady')).toBeNull();
  });
});

describe('MetricsPanel — stability warnings at the 20 % edge', () => {
  it('shows neither when both pairs sit exactly at 20 %', () => {
    renderPanel(tenDaysTo(1000, 100, 500), { kind: 'all' });
    expect(cardValue('Throughput')).toBe('50.0/d'); // control: the series is the edge
    expect(cardValue('Start Rate')).toBe('40.0/d');
    expect(cardValue('Arrival Rate')).toBe('40.0/d');
    expect(screen.queryByText('Flow is not steady')).toBeNull();
  });

  it('warns about Cycle Time alone just past the edge', () => {
    renderPanel(tenDaysTo(1010, 90, 500), { kind: 'all' });
    expect(screen.getByText('Flow is not steady')).toBeTruthy();
    expect(warningShown(CYCLE_SLOW)).toBe(true);
    expect(warningShown(LEAD_SLOW)).toBe(false);
  });

  it('warns about Lead Time alone just past the edge', () => {
    renderPanel(tenDaysTo(990, 100, 500), { kind: 'all' });
    expect(warningShown(LEAD_SLOW)).toBe(true);
    expect(warningShown(CYCLE_SLOW)).toBe(false);
  });

  it('names the other direction when work starts and arrives faster than it finishes', () => {
    renderPanel(tenDaysTo(1000, 310, 400), { kind: 'all' });
    expect(warningShown(CYCLE_FAST)).toBe(true);
    expect(warningShown(LEAD_FAST)).toBe(true);
  });

  it('says why Arrival Rate reads 0 when more items were removed than arrived', () => {
    renderPanel([snap('2026-03-01', 4, 0, 20), snap('2026-03-11', 4, 10, 5)], { kind: 'all' });
    expect(cardValue('Arrival Rate')).toBe('0.0/d');
    // 0 arrived against 10 finished is wider than chance: the lean and the fall
    expect(warningShown(LEAD_SLOW)).toBe(true);
    expect(warningShown(REMOVED)).toBe(true);
  });

  it('holds back a warning when too few items moved for 20 % to mean much', () => {
    renderPanel(tenDaysTo(1000, 195, 10), { kind: 'all' });
    expect(cardValue('Start Rate')).toBe('0.5/d'); // control: 50 % slower than
    expect(cardValue('Throughput')).toBe('1.0/d'); // it finishes, on 5 and 10 items
    expect(screen.queryByText('Flow is not steady')).toBeNull();
  });
});

describe('MetricsPanel — a falling Done takes precedence', () => {
  // Work starts far faster than it finishes over the period (100 vs 40 in
  // three days); the only difference between the two series is Done on day 3.
  const series = (doneOnDay3: number) => [
    snap('2026-03-01', 0, 0, 100),
    snap('2026-03-02', 10, 20, 70),
    snap('2026-03-03', 10, doneOnDay3, 70),
    snap('2026-03-04', 60, 40, 0),
  ];

  it('shows the stability warning when Done is cumulative (control)', () => {
    renderPanel(series(25), { kind: 'all' });
    expect(warningShown(CYCLE_FAST)).toBe(true);
  });

  it('shows only the Done warning when Done went down', () => {
    renderPanel(series(15), { kind: 'all' });
    expect(screen.getByText('Done count went down')).toBeTruthy();
    expect(screen.queryByText('Flow is not steady')).toBeNull();
    expect(warningShown(CYCLE_FAST)).toBe(false);
  });
});
