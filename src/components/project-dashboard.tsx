// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useMemo } from 'react';
import { useActiveProject } from '@/contexts/active-project-context';
import { getStorageUsage } from '@/lib/storage-health';
import { WorkflowEditor } from './workflow/workflow-editor';
import { DataGrid } from './grid/data-grid';
import { CFDChart } from './chart/cfd-chart';
import { MetricsPanel } from './metrics/metrics-panel';

export function ProjectDashboard() {
  const { project } = useActiveProject();
  // Memoize storage usage calculation - only recalculate when project is updated
  const usage = useMemo(() => getStorageUsage(), [project?.updatedAt]);

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500">
        No project selected. Create or import a project to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
        <WorkflowEditor />

        <MetricsPanel />

        {/* Storage indicator */}
        <div className="mt-auto pt-6">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Storage:</span>
            <span
              className={
                usage.status === 'critical'
                  ? 'text-red-600 font-medium'
                  : usage.status === 'warning'
                    ? 'text-amber-600 font-medium'
                    : ''
              }
            >
              {(usage.bytes / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4">
        <CFDChart />

        <DataGrid />
      </main>
    </div>
  );
}
