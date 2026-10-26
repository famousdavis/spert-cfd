// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useMemo } from 'react';
import { useActiveProject } from '@/contexts/active-project-context';
import { calculateMetrics, normalizePeriod, type DoneDecrease } from '@/lib/calculations';
import { formatDate, formatDateShort } from '@/lib/dates';
import type { MetricsPeriod } from '@/types';
import { MetricCard } from './metric-card';
import { AlertTriangle } from 'lucide-react';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All data' },
  { value: 'days-7', label: 'Last 7 days' },
  { value: 'days-14', label: 'Last 14 days' },
  { value: 'days-30', label: 'Last 30 days' },
  { value: 'days-90', label: 'Last 90 days' },
];

function periodValue(period: MetricsPeriod): string {
  switch (period.kind) {
    case 'all':
      return 'all';
    case 'days':
      return `days-${period.value}`;
    case 'range':
      return 'range';
  }
}

/**
 * A name for a period no option offers (it arrived by import or from a cloud
 * document), so the select never says "All data" above metrics computed on
 * another window.
 */
function periodLabel(period: MetricsPeriod): string {
  if (period.kind === 'days') {
    return `Last ${period.value} day${period.value === 1 ? '' : 's'}`;
  }
  if (period.kind === 'range') {
    const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
    const start = sameYear ? formatDateShort(period.start) : formatDate(period.start);
    return `Custom: ${start} – ${formatDate(period.end)}`;
  }
  return 'All data';
}

function DoneDecreaseWarning({ from, to }: DoneDecrease) {
  return (
    <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2">
      <div className="flex items-center gap-1 text-xs font-medium text-amber-800 mb-1">
        <AlertTriangle size={12} aria-hidden="true" />
        Done count went down
      </div>
      <p className="text-xs text-amber-700">
        Between {formatDate(from)} and {formatDate(to)}. A CFD needs cumulative
        Done counts (every item finished so far), so Throughput and Lead Time
        may be wrong.
      </p>
    </div>
  );
}

export function MetricsPanel() {
  const { workflow, snapshots, settings, updateSettings } = useActiveProject();
  const period = normalizePeriod(settings.metricsPeriod);
  const selected = periodValue(period);
  const isPreset = PERIOD_OPTIONS.some((o) => o.value === selected);

  const metrics = useMemo(
    () => calculateMetrics(workflow, snapshots, settings.metricsPeriod),
    [workflow, snapshots, settings.metricsPeriod],
  );

  if (snapshots.length === 0) {
    return (
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Metrics
        </h2>
        <p className="text-xs text-gray-400">Add data to see metrics</p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Metrics
        </h2>
        <select
          id="metrics-period"
          name="metrics-period"
          value={selected}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'all') {
              updateSettings({ metricsPeriod: { kind: 'all' } });
            } else if (val.startsWith('days-')) {
              const days = parseInt(val.split('-')[1], 10);
              updateSettings({ metricsPeriod: { kind: 'days', value: days } });
            }
          }}
          className="rounded border border-gray-300 px-1 py-0.5 text-xs"
          aria-label="Metrics period"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {!isPreset && (
            <option value={selected} disabled>
              {periodLabel(period)}
            </option>
          )}
        </select>
      </div>

      {metrics.doneDecrease && <DoneDecreaseWarning {...metrics.doneDecrease} />}

      <div className="space-y-1.5">
        <MetricCard
          label="WIP"
          value={String(metrics.totalWip)}
          sublabel="active items"
        />
        <MetricCard
          label="Throughput"
          value={`${metrics.throughput.toFixed(1)}/d`}
          sublabel="items completed"
        />
        <MetricCard
          label="Lead Time"
          value={metrics.avgLeadTime > 0 ? `${metrics.avgLeadTime.toFixed(1)}d` : '—'}
          sublabel="Little's Law"
        />
        <MetricCard
          label="Arrival Rate"
          value={`${metrics.arrivalRate.toFixed(1)}/d`}
          sublabel="items entering"
        />
      </div>

      {/* WIP Violations */}
      {metrics.wipViolations.length > 0 && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
          <div className="flex items-center gap-1 text-xs font-medium text-amber-800 mb-1">
            <AlertTriangle size={12} />
            WIP Violations
          </div>
          {metrics.wipViolations.map((v) => (
            <div key={v.stateId} className="text-xs text-amber-700">
              {v.stateName}: {v.current}/{v.limit}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
