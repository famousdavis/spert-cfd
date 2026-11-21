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
            isAnimationActive={false}
          />
        )),
    [sortedWorkflow, hiddenStates],
  );

  if (snapshots.length === 0) {
    return (
      // v0.18.0 (DASH26 O13): no label row here; the CFD tab's project picker,
      // above this section, names the open project in both branches.
      <section>
        <div className="flex h-48 items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-400">
          Add snapshot data to see the CFD chart
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2" aria-label="Cumulative Flow Diagram">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <XAxis
              dataKey="dateFormatted"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} width={40} />
            {/* v0.19.1 (DASH26 RD1): recharts draws the tooltip box white with a
                #ccc border as INLINE styles, which only `!important` overrides:
                hence `dark:!`. The label takes the box's text colour; each line
                keeps its state's colour in both themes (O28). The axes and the
                Brush background are dark through globals.css. */}
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ fontSize: 12 }}
              wrapperClassName="dark:!bg-gray-900 dark:!border-gray-600 dark:text-gray-100"
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
