// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId } from 'react';
import { TOOLBAR_BUTTON, TOOLBAR_PRIMARY, TOOLBAR_SECONDARY } from './toolbar-button-styles';

// The panel's buttons are the toolbar's: the frame's 36 px `.sf-btn` for the
// size, CFD's own strings for colour, corners and hover (contract §10).
const PRIMARY = `sf-btn ${TOOLBAR_BUTTON} ${TOOLBAR_PRIMARY}`;
const SECONDARY = `sf-btn ${TOOLBAR_BUTTON} ${TOOLBAR_SECONDARY}`;

interface ProjectsEmptyStateProps {
  onCreateNew: () => void;
  onLoadSample: () => void;
}

/**
 * The Welcome panel (contract §3, §7; stylesheet v3): shown in the tile grid's
 * place when there are no projects, once the list has loaded and while no
 * import preview is open (the tab decides). The frame's `.sf-empty` draws it:
 * 16 px below the heading row, the full column wide, a 1 px dashed border on
 * the page ground in both themes. It carries the frame's `data-sf="empty"`
 * itself (until v0.23.0 a wrapper did, around CFD's own card: 24 px down,
 * 10 px corners, a #171717 card in dark, 35 px buttons and a dark note at
 * 3.71:1). The title is "Welcome to " and the brand row's title, its ® in the
 * same `.sf-mark`. Create New Project opens the New Project dialog, Load Sample
 * Project loads and opens the sample (DASH26 R11, R12; FRAME26 L).
 */
export function ProjectsEmptyState({ onCreateNew, onLoadSample }: ProjectsEmptyStateProps) {
  const headingId = useId();
  return (
    <div className="sf-empty" data-sf="empty" role="region" aria-labelledby={headingId}>
      <h2 id={headingId} className="sf-empty-title">
        Welcome to SPERT<span className="sf-mark">®</span> CFD
      </h2>
      <p className="sf-empty-text">
        See how work items flow through your process over time, and spot bottlenecks and WIP buildup early.
      </p>
      <div className="sf-empty-actions">
        <button type="button" onClick={onCreateNew} className={PRIMARY}>
          Create New Project
        </button>
        <button type="button" onClick={onLoadSample} className={SECONDARY}>
          Load Sample Project
        </button>
      </div>
      <p className="sf-empty-note">
        The sample project is a working example with 14 days of snapshots. You can explore it, edit it, or delete it
        at any time.
      </p>
    </div>
  );
}
