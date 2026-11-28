// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type { ChangeEvent, RefObject } from 'react';
import { ToolbarIcon } from './icons/toolbar-icon';
import { TOOLBAR_ICON_PATHS } from './icons/toolbar-icon-paths';
import {
  TOOLBAR_BUTTON,
  TOOLBAR_ICON_PRIMARY,
  TOOLBAR_ICON_SECONDARY,
  TOOLBAR_PRIMARY,
  TOOLBAR_SECONDARY,
} from './toolbar-button-styles';

// The toolbar's buttons carry the frame's `.sf-btn` (36 px, 14 px / 500, 18 px
// icons; contract §2, v0.22.0): it sets the size, which beats the shared
// strings' 35.09 px and 14.4 px. Colours, corners and hover stay these.
const SECONDARY = `sf-btn ${TOOLBAR_BUTTON} ${TOOLBAR_SECONDARY}`;
const PRIMARY = `sf-btn ${TOOLBAR_BUTTON} ${TOOLBAR_PRIMARY}`;

interface ProjectsToolbarProps {
  projectCount: number;
  driverLoading: boolean;
  onExportAll: () => void;
  onImportClick: () => void;
  onLoadSample: () => void;
  onNewProject: () => void;
  loadSampleRef: RefObject<HTMLButtonElement | null>;
  newProjectRef: RefObject<HTMLButtonElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  onImportFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * The Projects heading row's toolbar and the hidden file input Import opens
 * (v0.24.0, FRAME26 pass 3, C1: moved from projects-tab.tsx unchanged; the
 * handlers and refs stay the tab's).
 */
export function ProjectsToolbar({
  projectCount,
  driverLoading,
  onExportAll,
  onImportClick,
  onLoadSample,
  onNewProject,
  loadSampleRef,
  newProjectRef,
  importInputRef,
  onImportFileChange,
}: ProjectsToolbarProps) {
  return (
    <>
      <div className="sf-toolbar" data-sf="toolbar">
        <button
          type="button"
          onClick={onExportAll}
          disabled={projectCount === 0}
          aria-label="Export all projects as JSON"
          className={SECONDARY}
        >
          <ToolbarIcon d={TOOLBAR_ICON_PATHS.export} className={TOOLBAR_ICON_SECONDARY} />
          Export All
        </button>
        <button
          type="button"
          onClick={onImportClick}
          disabled={driverLoading}
          aria-label="Import projects from JSON"
          className={SECONDARY}
        >
          <ToolbarIcon d={TOOLBAR_ICON_PATHS.import} className={TOOLBAR_ICON_SECONDARY} />
          Import
        </button>
        <button
          ref={loadSampleRef}
          type="button"
          onClick={onLoadSample}
          className={SECONDARY}
        >
          <ToolbarIcon d={TOOLBAR_ICON_PATHS.sample} className={TOOLBAR_ICON_SECONDARY} />
          Load Sample
        </button>
        <button
          ref={newProjectRef}
          type="button"
          onClick={onNewProject}
          className={PRIMARY}
        >
          <ToolbarIcon d={TOOLBAR_ICON_PATHS.plus} className={TOOLBAR_ICON_PRIMARY} />
          New Project
        </button>
      </div>
      <input
        id="import-project-file"
        name="import-project-file"
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        onChange={onImportFileChange}
        className="hidden"
        aria-label="Import project file"
      />
    </>
  );
}
