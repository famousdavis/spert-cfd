// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type { Project } from '@/types';
import type {
  ConflictResolution,
  ImportConflict,
  ImportDecisions,
} from '@/lib/import-utils';

interface ImportPreviewSectionProps {
  incoming: Project[];
  conflicts: ImportConflict[];
  decisions: ImportDecisions;
  applying: boolean;
  onSetDecision: (projectId: string, resolution: ConflictResolution) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const RESOLUTION_OPTIONS: { value: ConflictResolution; label: string }[] = [
  { value: 'skip', label: 'Skip' },
  { value: 'copy', label: 'Add as Copy' },
  { value: 'replace', label: 'Replace' },
];

export function ImportPreviewSection({
  incoming,
  conflicts,
  decisions,
  applying,
  onSetDecision,
  onConfirm,
  onCancel,
}: ImportPreviewSectionProps) {
  const conflictingIds = new Set(conflicts.map((c) => c.incoming.id));
  const cleanProjects = incoming.filter((p) => !conflictingIds.has(p.id));

  return (
    <section
      role="region"
      aria-labelledby="import-preview-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h2 id="import-preview-heading" className="text-sm font-semibold">
          Import preview
        </h2>
        <span className="text-xs text-gray-500">
          {incoming.length} project{incoming.length === 1 ? '' : 's'} in file
        </span>
      </header>

      {/* Non-conflicting projects */}
      {cleanProjects.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Will be added ({cleanProjects.length})
          </h3>
          <ul className="space-y-1">
            {cleanProjects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <span
                  aria-label="will be added"
                  className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700"
                >
                  Add
                </span>
                <span className="truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Conflicts ({conflicts.length}) — choose how to resolve each
          </h3>
          <ul className="space-y-3">
            {conflicts.map((c) => {
              const inc = c.incoming;
              const selected = decisions.get(inc.id) ?? 'skip';
              const groupId = `import-decision-${inc.id}`;
              return (
                <li
                  key={inc.id}
                  className="rounded border border-gray-200 p-3"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-gray-800">
                        {inc.name}
                      </span>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {c.type === 'id'
                          ? `ID matches existing project "${c.existing.name}"`
                          : `Name matches existing project "${c.existing.name}"`}
                      </p>
                    </div>
                    <span
                      aria-label={
                        c.type === 'id' ? 'id conflict' : 'name conflict'
                      }
                      className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700"
                    >
                      {c.type === 'id' ? 'ID conflict' : 'Name conflict'}
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`Resolution for ${inc.name}`}
                    className="flex flex-wrap gap-3 text-sm"
                  >
                    {RESOLUTION_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-1.5 text-gray-700"
                      >
                        <input
                          type="radio"
                          name={groupId}
                          value={opt.value}
                          checked={selected === opt.value}
                          onChange={() => onSetDecision(inc.id, opt.value)}
                          disabled={applying}
                          className="h-3.5 w-3.5"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex justify-end gap-2 border-t pt-3">
        <button
          onClick={onCancel}
          disabled={applying}
          className="rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={applying}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {applying ? 'Importing…' : 'Confirm import'}
        </button>
      </div>
    </section>
  );
}
