// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useState } from 'react';
import { useProjectList } from '@/contexts/project-list-context';
import { useStorage } from '@/contexts/storage-context';
import {
  downloadFile,
  exportFilename,
  exportAllFilename,
} from '@/lib/download';

export function ProjectExportSection() {
  const { projects } = useProjectList();
  const { driver } = useStorage();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected =
    projects.length > 0 && selectedIds.size === projects.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
    }
  };

  const handleExport = useCallback(async () => {
    setError(null);
    const idsToExport = projects
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.id);
    if (idsToExport.length === 0) return;

    try {
      const loaded = (
        await Promise.all(idsToExport.map((id) => driver.loadProject(id)))
      ).filter((p): p is NonNullable<typeof p> => p !== null);

      if (loaded.length === 0) {
        setError('Could not load any of the selected projects.');
        return;
      }

      if (loaded.length === 1) {
        const json = driver.exportProject(loaded[0]);
        downloadFile(
          json,
          exportFilename(loaded[0].name, 'json'),
          'application/json',
        );
        return;
      }

      // Multi-project: route each project through driver.exportProject so
      // cloud-only fields (owner, members, schemaVersion) are stripped, then
      // combine into a JSON array.
      const sanitized = loaded.map((p) => JSON.parse(driver.exportProject(p)));
      const json = JSON.stringify(sanitized, null, 2);
      downloadFile(json, exportAllFilename('json'), 'application/json');
    } catch (err) {
      console.error(
        'Export failed:',
        (err as { code?: string }).code ?? 'unknown',
      );
      setError('Export failed. Please try again.');
    }
  }, [projects, selectedIds, driver]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900">Export Projects</h3>
      <p className="mt-1 text-sm text-gray-500">
        Download selected projects as a JSON file for backup or sharing.
      </p>

      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No projects to export.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {/* Select all toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="export-select-all"
              name="export-select-all"
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-gray-300 accent-blue-600"
            />
            <span className="font-medium">
              {allSelected ? 'Deselect all' : 'Select all'}
            </span>
          </label>

          {/* Project list (name-only) */}
          <div className="max-h-64 overflow-y-auto rounded-md border border-gray-100 divide-y divide-gray-100">
            {projects.map((project) => {
              const checkboxId = `export-project-${project.id}`;
              return (
                <label
                  key={project.id}
                  htmlFor={checkboxId}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    id={checkboxId}
                    name={checkboxId}
                    type="checkbox"
                    aria-label={`Select ${project.name} for export`}
                    checked={selectedIds.has(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="rounded border-gray-300 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {project.name}
                  </span>
                </label>
              );
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Export button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedIds.size === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      )}
    </section>
  );
}
