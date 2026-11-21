// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useActiveProject } from '@/contexts/active-project-context';
import { useProjectList } from '@/contexts/project-list-context';
import { useStorage } from '@/contexts/storage-context';
import { getStorageUsage } from '@/lib/storage-health';
import { STORAGE_FULL_MESSAGE } from '@/lib/storage-errors';
import { WorkflowEditor } from './workflow/workflow-editor';
import { DataGrid } from './grid/data-grid';
import { CFDChart } from './chart/cfd-chart';
import { MetricsPanel } from './metrics/metrics-panel';
import { ErrorBoundary } from './error-boundary';
import { ProjectPicker } from './project-picker';
import { ViewErrorNotice } from './view-error-notice';
import { PAGE_COLUMN } from './page-column';

interface ProjectDashboardProps {
  onGoToProjects?: () => void;
  /** Passed to the picker: true once when focus should land on it as it mounts (DASH26 O14). */
  takePickerFocus?: () => boolean;
}

/**
 * The CFD tab.
 *
 * v0.18.0 (DASH26 R1a D1): the per-project key is HERE, below the project
 * picker, no longer on the tab's error boundary in `app-shell.tsx`. Each
 * project gets a fresh sidebar, chart and grid, and the chart and the grid a
 * fresh error boundary (v0.16.4: one project's bad data never blocks another),
 * but the picker and the scroll area stay mounted, so a switch made from the
 * picker keeps its focus and the browser's type-ahead. A crash in the chart or
 * the grid shows its notice inside the panel, with the picker still above it.
 * The scroll area goes back to the top on a switch, as the remount used to.
 *
 * ⚠️ The key is the LOADED project's id (`project.id`), never the list's
 * `activeProjectId`. A switch changes `activeProjectId` at once, while
 * `active-project-context` keeps the previous project until the new one has
 * loaded. Keyed by `activeProjectId`, a fresh boundary rendered the PREVIOUS
 * project's data first, caught its crash again, and stayed failed when the
 * good project arrived: after a chart crash, choosing a good project left the
 * notice in place (DASH26 PR #108 review, -01; measured).
 *
 * The tree keeps the same shape with and without an open project (the aside
 * slot and `main` are always at the same positions), so the picker also
 * survives the moment a project first opens.
 *
 * v0.19.0 (DASH26 R25, O24, F4): an edit refused because the browser's storage
 * is full shows an alert ABOVE the bordered panel, outside `main`'s scroll
 * area, so it is seen wherever the edit was made (the grid is usually
 * scrolled below the chart). Dismiss, or the next save that succeeds, clears it.
 */
export function ProjectDashboard({ onGoToProjects, takePickerFocus }: ProjectDashboardProps) {
  const { project, storageFull, dismissStorageFull } = useActiveProject();
  const { projects, activeProjectId } = useProjectList();
  const { driver } = useStorage();
  const mainRef = useRef<HTMLElement>(null);
  // Memoize storage usage calculation — recompute when the active
  // project saves. updatedAt isn't used inside the memo body; it's an
  // intentional invalidation trigger because a save is what mutates
  // the underlying localStorage size that getStorageUsage() reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const usage = useMemo(() => getStorageUsage(), [project?.updatedAt]);

  // A switch shows the new project from its top.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeProjectId]);

  const open = project !== null;
  // DASH26 O15: with projects but none open, the picker still shows, above
  // today's empty state.
  const showPicker = projects.length > 0;

  return (
    // A bordered panel in the page's column, under the header and the tabs.
    <div className={`${PAGE_COLUMN} flex flex-1 flex-col overflow-hidden py-4`}>
      {storageFull && (
        <div role="alert" className="mb-4 flex flex-none items-center justify-between rounded bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{STORAGE_FULL_MESSAGE}</span>
          <button type="button" onClick={dismissStorageFull} className="ml-4 text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}
      <div className={open ? 'flex min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white' : 'flex min-h-0 w-full flex-1 overflow-hidden'}>
        {/* Left sidebar, remounted for each project */}
        {open && (
          <aside key={project.id} className="w-64 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            <WorkflowEditor />

            <MetricsPanel />

            {/* Storage indicator (local mode only) */}
            {driver.mode === 'local' && (
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
            )}
          </aside>
        )}

        {/* Main content */}
        <main ref={mainRef} className={open ? 'flex-1 overflow-y-auto p-4' : 'flex flex-1 flex-col overflow-y-auto p-4'}>
          {showPicker && <ProjectPicker takeFocus={takePickerFocus} />}

          {open ? (
            <ErrorBoundary key={project.id} fallback={<ViewErrorNotice />}>
              <CFDChart />

              <DataGrid />
            </ErrorBoundary>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-500">
              <p>Open a project from the Projects tab to view its CFD.</p>
              {onGoToProjects && (
                <button
                  onClick={onGoToProjects}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  Go to Projects
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
