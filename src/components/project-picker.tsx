// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef } from 'react';
import { useProjectList } from '@/contexts/project-list-context';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';
import { PICKER_ROW, PICKER_SELECT } from './dashboard-styles';

/** A singleton on the CFD tab, so a fixed id is safe. */
const PICKER_ID = 'cfd-project-picker';

interface ProjectPickerProps {
  /** True once when focus should land here as the picker mounts (a tile's Open, or Load Sample: DASH26 O14). */
  takeFocus?: () => boolean;
}

/**
 * "Cumulative flow for [project ▾]" (v0.18.0, DASH26 R8, R22, O13): the CFD
 * tab names the open project, and switches it, in one 16 px row above the
 * chart. It replaced the chart's "Cumulative Flow Diagram" label and the
 * "Chart" label of a project with no snapshots, so every open project is named.
 *
 * ⚠️ This select must stay MOUNTED across a switch it makes: it sits above the
 * CFD tab's per-project key (`project-dashboard.tsx`), not under it. Remounted,
 * a switch dropped focus to <body>, and restoring focus after the remount still
 * broke the browser's type-ahead, which starts a new search in each new
 * element: typing "sa" landed on "Alpha", not "Sample" (measured, DASH26 R1a
 * pre-flight).
 *
 * The visible words are the select's <label>, so its accessible name is
 * "Cumulative flow for" and the value read with it is the project. The value is
 * the open project's id from the list (DASH26 §7 L1), so while a switch loads
 * the select already names the project being opened. With projects but none
 * open, a disabled "Choose a project" option shows (O15). Two projects with
 * the same name read the same here, as in the siblings' pickers.
 */
export function ProjectPicker({ takeFocus }: ProjectPickerProps) {
  const { projects, activeProjectId, switchProject } = useProjectList();
  const selectRef = useRef<HTMLSelectElement>(null);
  const takeFocusRef = useRef(takeFocus);

  // Once, as it mounts: a tile's Open (or Load Sample) asked for focus here.
  useEffect(() => {
    if (takeFocusRef.current?.()) selectRef.current?.focus();
  }, []);

  const known = activeProjectId !== null && projects.some((p) => p.id === activeProjectId);

  return (
    <h2 className={PICKER_ROW}>
      <label htmlFor={PICKER_ID} className="flex-none">
        Cumulative flow for
      </label>
      <select
        ref={selectRef}
        id={PICKER_ID}
        name="cfdProject"
        value={known ? (activeProjectId as string) : ''}
        onChange={(e) => {
          if (e.target.value) switchProject(e.target.value);
        }}
        className={PICKER_SELECT}
      >
        {!known && (
          <option value="" disabled>
            Choose a project
          </option>
        )}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || UNNAMED_PROJECT}
          </option>
        ))}
      </select>
    </h2>
  );
}
