// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 O13): the real chart carries no label row of its own in
// either branch: the CFD tab's project picker, above it, names the open project.
// Before, a project with snapshots showed "Cumulative Flow Diagram" and one
// without showed "Chart". The real `cfd-chart.tsx` is rendered here (the
// dashboard's picker tests use a stand-in), so putting either label back fails.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import type { Snapshot, WorkflowState } from '@/types';

const h = vi.hoisted(() => ({ snapshots: [] as Snapshot[] }));
const WORKFLOW: WorkflowState[] = [
  { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
  { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 },
];
vi.mock('@/contexts/active-project-context', () => ({
  useActiveProject: () => ({ workflow: WORKFLOW, snapshots: h.snapshots }),
}));

import { CFDChart } from '../chart/cfd-chart';

beforeAll(() => {
  // Recharts' ResponsiveContainer measures with ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/** Every text node of the chart's section, outside the plot's own svg. */
function textOutsidePlot(container: HTMLElement) {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('svg, .recharts-wrapper').forEach((n) => n.remove());
  return clone.textContent ?? '';
}

describe('CFDChart has no label row (O13)', () => {
  it('with no snapshots: the placeholder alone, no "Chart" label', () => {
    h.snapshots = [];
    const { container } = render(<CFDChart />);
    expect(container.querySelector('h1, h2, h3, h4, [role="heading"]')).toBeNull();
    expect(textOutsidePlot(container).trim()).toBe('Add snapshot data to see the CFD chart');
  });

  it('with snapshots: the plot card first, no "Cumulative Flow Diagram" label', () => {
    h.snapshots = [
      { date: '2026-06-01', counts: { backlog: 3, done: 0 } },
      { date: '2026-06-02', counts: { backlog: 2, done: 1 } },
    ];
    const { container } = render(<CFDChart />);
    const section = container.querySelector('section')!;
    expect(container.querySelector('h1, h2, h3, h4, [role="heading"]')).toBeNull();
    expect(section.firstElementChild?.getAttribute('aria-label')).toBe('Cumulative Flow Diagram');
    expect(textOutsidePlot(container)).not.toContain('Cumulative Flow Diagram');
    expect(textOutsidePlot(container)).not.toMatch(/\bChart\b/);
  });
});
