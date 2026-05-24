// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Project } from '@/types';
import type {
  ConflictResolution,
  ImportConflict,
  ImportDecisions,
} from '@/lib/import-utils';
import { useEscapeKey } from '@/lib/use-dismiss';
import { useStorage } from '@/contexts/storage-context';

interface ImportPreviewSectionProps {
  incoming: Project[];
  conflicts: ImportConflict[];
  decisions: ImportDecisions;
  applying: boolean;
  /** C2: true while the storage driver is hydrating its project list. */
  driverLoading: boolean;
  /** C1: count of existing projects in the workspace at preview time. */
  existingCount: number;
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
  driverLoading,
  existingCount,
  onSetDecision,
  onConfirm,
  onCancel,
}: ImportPreviewSectionProps) {
  // Data-sourcing note: driverLoading and existingCount arrive as props —
  // consistent with the existing pattern and avoids re-subscribing to the
  // project list. `mode` is read from useStorage() directly because threading
  // it as a prop for one read adds noise without architectural benefit;
  // ImportPreviewSection already lives inside StorageProvider. If more storage
  // context is needed here in the future, consider promoting to props for
  // consistency.
  const { mode } = useStorage();

  // M3: Move focus to the heading on mount for screen-reader announcement.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // C3: Gate Escape on applying only — cancelling during driverLoading is
  // always safe (no write in flight) and matches the Cancel button, which is
  // also only disabled while applying.
  const handleEscape = useCallback(() => {
    if (!applying) onCancel();
  }, [applying, onCancel]);
  useEscapeKey(handleEscape);

  const conflictingIds = new Set(conflicts.map((c) => c.incoming.id));
  const cleanProjects = incoming.filter((p) => !conflictingIds.has(p.id));

  return (
    <section
      role="region"
      aria-labelledby="import-preview-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h2
          ref={headingRef}
          id="import-preview-heading"
          tabIndex={-1}
          className="text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          Import preview
        </h2>
        <span className="text-xs text-gray-500">
          {incoming.length} project{incoming.length === 1 ? '' : 's'} in file
        </span>
      </header>

      {/* C2: driverLoading hint — stable role="status" container; live region
          announces content changes, not the empty state on mount. */}
      <div role="status" aria-live="polite">
        {driverLoading && (
          <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Project list is updating — please wait before confirming.
          </p>
        )}
      </div>

      {/* C1: Cloud hydration hint per IMPORT-DESIGN-GUIDE §"Cloud Hydration
          Hint in Preview UI". Trigger: cloud mode + zero existing projects +
          non-zero incoming projects. existingCount === 0 (not
          conflicts.length === 0) is the correct signal — conflicts only
          counts incoming projects that matched an existing one; a user with
          5 existing projects importing 2 new projects with no overlaps
          produces conflicts.length === 0 but existingCount === 5. The hint
          must not fire in that case. */}
      <div role="status" aria-live="polite">
        {mode === 'cloud' && existingCount === 0 && incoming.length > 0 && (
          <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
            If you just enabled cloud sync, your existing projects may still be
            loading. Cancel and try again once the dashboard shows your projects.
          </p>
        )}
      </div>

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
          disabled={applying || driverLoading}
          aria-busy={applying}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {applying ? 'Importing…' : 'Confirm import'}
        </button>
      </div>
    </section>
  );
}
