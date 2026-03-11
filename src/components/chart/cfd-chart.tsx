// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { memo, useMemo, useCallback, useState, type ComponentProps } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';

type TooltipFormatter = NonNullable<ComponentProps<typeof Tooltip>['formatter']>;
import { useActiveProject } from '@/contexts/active-project-context';
import { sortWorkflow } from '@/lib/dates';
import { useChartData } from './use-chart-data';
import { ChartControls } from './chart-controls';

export const CFDChart = memo(function CFDChart() {
  const { workflow, snapshots } = useActiveProject();
  const data = useChartData(workflow, snapshots);
  const sortedWorkflow = useMemo(() => sortWorkflow(workflow), [workflow]);

  const [hiddenStates, setHiddenStates] = useState<Set<string>>(new Set());

  const toggleState = useCallback((stateId: string) => {
    setHiddenStates((prev) => {
      const next = new Set(prev);
      if (next.has(stateId)) next.delete(stateId);
      else next.add(stateId);
      return next;
    });
  }, []);

  const tooltipFormatter = useCallback<TooltipFormatter>(
    (value, name) => {
      const state = name ? workflow.find((s) => s.id === name) : undefined;
      return [value ?? 0, state?.name ?? name ?? ''];
    },
    [workflow],
  );

  const areas = useMemo(
    () =>
      [...sortedWorkflow]
        .reverse()
        .filter((state) => !hiddenStates.has(state.id))
        .map((state) => (
          <Area
            key={state.id}
            type="monotone"
            dataKey={state.id}
            stackId="cfd"
            fill={state.color}
            stroke={state.color}
            fillOpacity={0.8}
            name={state.id}
          />
        )),
    [sortedWorkflow, hiddenStates],
  );

  if (snapshots.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Chart
        </h2>
        <div className="flex h-48 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
          Add snapshot data to see the CFD chart
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
        Cumulative Flow Diagram
      </h2>

      <div className="rounded border border-gray-200 bg-white p-2" aria-label="Cumulative Flow Diagram">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <XAxis
              dataKey="dateFormatted"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} width={40} />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ fontSize: 12 }}
            />
            {data.length > 14 && (
              <Brush
                dataKey="dateFormatted"
                height={24}
                stroke="#94a3b8"
                travellerWidth={8}
              />
            )}
            {areas}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ChartControls
        workflow={sortedWorkflow}
        hiddenStates={hiddenStates}
        onToggle={toggleState}
      />
    </section>
  );
});
