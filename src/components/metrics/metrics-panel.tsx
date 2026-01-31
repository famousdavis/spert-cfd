'use client';

import { useMemo } from 'react';
import { useActiveProject } from '@/contexts/active-project-context';
import { calculateMetrics } from '@/lib/calculations';
import { MetricCard } from './metric-card';
import { AlertTriangle } from 'lucide-react';

export function MetricsPanel() {
  const { workflow, snapshots, settings, updateSettings } = useActiveProject();

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
          value={
            settings.metricsPeriod.kind === 'all'
              ? 'all'
              : settings.metricsPeriod.kind === 'days'
                ? `days-${settings.metricsPeriod.value}`
                : 'all'
          }
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
          <option value="all">All data</option>
          <option value="days-7">Last 7 days</option>
          <option value="days-14">Last 14 days</option>
          <option value="days-30">Last 30 days</option>
          <option value="days-90">Last 90 days</option>
        </select>
      </div>

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
