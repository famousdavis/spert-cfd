// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId } from 'react';
import { TOOLBAR_BUTTON, TOOLBAR_PRIMARY, TOOLBAR_SECONDARY } from './toolbar-button-styles';

// SPERT® Forecaster's `ProjectsEmptyState` (the welcome variant,
// `src/shared/components/ProjectsEmptyState.tsx` at df59b2d), with CFD's words
// (DASH26 R11, R27). Forecaster's shadcn tokens are written out as the values
// they measure there (`A-measurements.md`): `rounded-lg` is 10 px in
// Forecaster (its `--radius`) but 8 px here, so the corner is given in px;
// `border-border` is #e5e5e5, `bg-card` white (#171717 dark), and its text
// tokens #333 and #666. The `dark:` classes are Forecaster's, inert until CFD
// has dark mode (R5).
const PANEL =
  'rounded-[10px] border border-dashed border-[#e5e5e5] bg-white p-8 text-center dark:border-gray-700 dark:bg-[#171717]';
const TITLE = 'mb-3 text-xl font-semibold text-[#333] dark:text-gray-100';
const TEXT = 'mx-auto max-w-prose text-sm text-[#666] dark:text-gray-400';
const BUTTONS = 'mt-6 flex flex-wrap items-center justify-center gap-3';
const NOTE = 'mx-auto mt-4 max-w-prose text-xs italic text-[#666] dark:text-gray-500';
/**
 * Load Sample Project: the toolbar's secondary look, transparent in dark mode
 * on this panel (Forecaster v0.50.3: its gray-900 showed as a bluer box on the
 * card). Forecaster appends `dark:bg-transparent` and lets tailwind-merge drop
 * the toolbar's `dark:bg-gray-900`; CFD has no tailwind-merge, where two
 * classes for one property are settled by stylesheet order, so the dark
 * background is replaced here instead.
 */
export const PANEL_SECONDARY = TOOLBAR_SECONDARY.replace('dark:bg-gray-900', 'dark:bg-transparent');

interface ProjectsEmptyStateProps {
  onCreateNew: () => void;
  onLoadSample: () => void;
}

/**
 * The welcome panel (v0.19.0, DASH26 R11): shown on the Projects tab when there
 * are no projects, once the list has loaded and while no import preview is
 * open (the tab decides). Its buttons are the toolbar's: Create New Project
 * opens the New Project dialog, Load Sample Project loads the sample (R12).
 */
export function ProjectsEmptyState({ onCreateNew, onLoadSample }: ProjectsEmptyStateProps) {
  const headingId = useId();
  return (
    <div className={PANEL} role="region" aria-labelledby={headingId}>
      <h2 id={headingId} className={TITLE}>
        Welcome to SPERT® CFD
      </h2>
      <p className={TEXT}>
        See how work items flow through your process over time, and spot bottlenecks and WIP buildup early.
      </p>
      <div className={BUTTONS}>
        <button type="button" onClick={onCreateNew} className={`${TOOLBAR_BUTTON} ${TOOLBAR_PRIMARY}`}>
          Create New Project
        </button>
        <button
          type="button"
          onClick={onLoadSample}
          className={`${TOOLBAR_BUTTON} ${PANEL_SECONDARY}`}
        >
          Load Sample Project
        </button>
      </div>
      <p className={NOTE}>
        The sample project is a working example with 14 days of snapshots. You can explore it, edit it, or delete it
        at any time.
      </p>
    </div>
  );
}
