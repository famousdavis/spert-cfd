// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useProjectList } from '@/contexts/project-list-context';
import type { ProjectListItem, StorageMode } from '@/lib/storage-driver';
import { useActiveProject } from '@/contexts/active-project-context';
import { useStorage } from '@/contexts/storage-context';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';
import { cloneSource } from '@/lib/clone-project';
import { isStorageFullError, STORAGE_FULL_MESSAGE } from '@/lib/storage-errors';
import { exportFilename, exportAllFilename, downloadFile } from '@/lib/download';
import { buildBannerText } from '@/lib/import-utils';
import { projectStats as statsOf, type ProjectStats } from '@/lib/project-tile-meta';
import { tileAccess } from '@/lib/tile-access';
import { findTileControl, focusAfterTileLeaves, resolveFocusTarget, type TileFocusTarget } from '@/lib/tile-focus';
import { useImportState } from '@/hooks/use-import-state';
import { ConfirmDialog } from './confirm-dialog';
import { ProjectDialog } from './project-dialog';
import { ProjectsEmptyState } from './projects-empty-state';
import { AllArchivedLine, ArchiveRows } from './archive-controls';
import { useProjectArchive } from './use-project-archive';
import { ToolbarIcon } from './icons/toolbar-icon';
import { TOOLBAR_ICON_PATHS } from './icons/toolbar-icon-paths';
import { ImportPreviewSection } from './import-preview-section';
import { SharingModal } from './sharing-modal';
import { SortableProjectTile } from './project-row';
import { HeadingRow } from './heading-row';
import {
  TOOLBAR_BUTTON,
  TOOLBAR_ICON_PRIMARY,
  TOOLBAR_ICON_SECONDARY,
  TOOLBAR_PRIMARY,
  TOOLBAR_SECONDARY,
} from './toolbar-button-styles';

interface ProjectsTabProps {
  onOpenInCfd: (id: string) => void;
}

/** The project dialog: New Project, or Edit for one project, by id. */
type DialogState = { kind: 'new' } | { kind: 'edit'; projectId: string; name: string } | null;

// The toolbar's buttons carry the frame's `.sf-btn` (36 px, 14 px / 500, 18 px
// icons; contract §2, v0.22.0): it sets the size, which beats the shared
// strings' 35.09 px and 14.4 px. Colours, corners and hover stay these.
const SECONDARY = `sf-btn ${TOOLBAR_BUTTON} ${TOOLBAR_SECONDARY}`;
const PRIMARY = `sf-btn ${TOOLBAR_BUTTON} ${TOOLBAR_PRIMARY}`;

/** Forecaster's pending line while the first cloud load is out (DASH26 O21). */
export const CLOUD_PENDING_TEXT = 'Loading your cloud projects — import will be available shortly.';

/** O24's words for a refused local save, else the action's own. */
function failureText(err: unknown, own: string): string {
  return isStorageFullError(err) ? STORAGE_FULL_MESSAGE : own;
}

const cloneFailedText = (name: string) => `Couldn't clone "${name}" — the copy wasn't saved. Please try again.`;

export function ProjectsTab({ onOpenInCfd }: ProjectsTabProps) {
  const {
    projects,
    driverLoading,
    createProject,
    loadSampleProject,
    cloneProject,
    deleteProject,
    renameProject,
    moveProject,
  } = useProjectList();
  const { project: loadedProject } = useActiveProject();
  const { driver } = useStorage();

  // New Project, always rendered: where focus goes when a New Project dialog closes.
  const newProjectButtonRef = useRef<HTMLButtonElement>(null);
  // The toolbar's Load Sample: where focus goes before the welcome panel's own
  // Load Sample Project unmounts under it (v0.19.0).
  const loadSampleButtonRef = useRef<HTMLButtonElement>(null);
  // The tab's root, where a tile's controls are found by project id when focus must land on one.
  const rootRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ target: TileFocusTarget } | null>(null);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState<Map<string, ProjectStats>>(new Map());
  const [uiError, setUiError] = useState<string | null>(null);
  // v0.19.0 (DASH26 O19): the last clone's words, "" when none. Read by an
  // always-mounted sr-only status region; a visible line repeats them only
  // while there is text, so an empty one adds no space.
  const [cloneStatus, setCloneStatus] = useState('');
  const cloneStatusTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(cloneStatusTimer.current), []);

  // Every failure alert clears the clone's words (O19).
  const showError = useCallback((text: string) => {
    window.clearTimeout(cloneStatusTimer.current);
    setCloneStatus('');
    setUiError(text);
  }, []);

  const {
    flowPhase: importFlowPhase,
    applying: importApplying,
    inputRef: importInputRef,
    setDecision: setImportDecision,
    handleImportClick: onImportClick,
    handleFileChange: onImportFileChange,
    handleConfirmImport: onConfirmImport,
    handleCancel: onCancelImport,
    handleReplaceConfirmed: onReplaceConfirmed,
    dismissReplaceConfirm: onDismissReplaceConfirm,
    handleDismissBanner: onDismissImportBanner,
  } = useImportState();

  // O19: the import's error alert clears the clone's words too, as every
  // failure alert does (PR #109 review -04, G4). Adjusted during render on the
  // move into the error phase, as the dialog's close below is.
  const [seenImportPhase, setSeenImportPhase] = useState(importFlowPhase.phase);
  if (seenImportPhase !== importFlowPhase.phase) {
    setSeenImportPhase(importFlowPhase.phase);
    if (importFlowPhase.phase === 'error') setCloneStatus('');
  }

  // v0.18.0: reordering is by pointer drag on the grip only, as in the
  // siblings. The KeyboardSensor is gone: it never worked (no
  // sortableKeyboardCoordinates, and its key listener sat on an element that
  // could not take focus), and the focusable "sortable" wrapper it needed is
  // gone with it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // v0.21.0 (DASH26 R2): colour and archive. `projects` stays the full list
  // for every count, save, export and name check (O61); only the grid, the
  // drag and focus read the shown list.
  const requestFocus = useCallback((target: TileFocusTarget) => setFocusRequest({ target }), []);
  const archiveView = useProjectArchive({
    projects,
    dialogOpen: [dialog, deleteConfirmId, sharingProjectId].some((open) => open !== null),
    onOpenInCfd,
    requestFocus,
    showError,
  });
  const { shown } = archiveView;
  // dnd-kit sorts the shown tiles only (DASH26 §7 answer 8): a hidden tile is
  // never one of its items, and keeps its slot in the stored order.
  const shownIds = shown.map((p) => p.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      // v0.20.2 (DASH26 R2o): the move itself, never the list it gives here;
      // the driver applies it to the order it reads now (O53a), among the
      // tiles shown (v0.21.0).
      moveProject(String(active.id), String(over.id), shownIds);
    },
    [moveProject, shownIds]
  );

  // Load full project data for the tiles' meta lines via driver (async).
  // Access (badges, Share, the Delete and Edit gates) comes from the list item,
  // never from here (v0.18.0).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, ProjectStats>();
      for (const p of projects) {
        // v0.16.4: one project that cannot be read leaves the others' stats.
        const full = await driver.loadProject(p.id).catch(() => null);
        if (full) map.set(p.id, statsOf(full));
      }
      if (!cancelled) setProjectStats(map);
    })();
    return () => { cancelled = true; };
  }, [projects, driver]);

  // A project whose Edit dialog is open left the list (unshared, or deleted on
  // another device: cloud mode only): the dialog closes, nothing is saved.
  // Adjusted during render, as Forecaster's useProjectDialog does, so no frame
  // shows the dialog for a project that is gone.
  if (dialog?.kind === 'edit' && !projects.some((p) => p.id === dialog.projectId)) {
    setDialog(null);
  }

  // Focus after the Delete confirmation closes (DASH26 O12, D7), moved after
  // the commit, once the dialog is gone. Neither target may exist (cloud mode
  // can replace the list): then focus nothing.
  useEffect(() => {
    if (!focusRequest) return;
    resolveFocusTarget(rootRef.current, focusRequest.target, newProjectButtonRef.current)?.focus();
  }, [focusRequest]);

  const closeDialog = useCallback(() => setDialog(null), []);

  // Read when the dialog has closed and the page is no longer inert.
  const returnFocusFromDialog = useCallback((): HTMLElement | null => {
    if (dialog?.kind === 'edit') {
      return findTileControl(rootRef.current, dialog.projectId, 'edit') ?? newProjectButtonRef.current;
    }
    return newProjectButtonRef.current;
  }, [dialog]);

  const handleCreate = useCallback((name: string) => {
    setDialog(null);
    createProject(name).catch((err: unknown) => {
      showError(failureText(err, `Couldn't create "${name}" — it wasn't saved. Please try again.`));
    });
  }, [createProject, showError]);

  // Edit renames through renameProject, which v0.17.6 keeps the open copy in
  // step with. An unchanged name saves nothing, as the inline rename did.
  const handleUpdate = useCallback((name: string) => {
    if (dialog?.kind === 'edit' && name !== dialog.name) renameProject(dialog.projectId, name);
    setDialog(null);
  }, [dialog, renameProject]);

  const handleEdit = useCallback((id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) setDialog({ kind: 'edit', projectId: id, name: project.name });
  }, [projects]);

  // v0.17.0: a fresh sample, in either storage mode, opened the way a tile
  // opens a project once it is saved.
  const handleLoadSample = useCallback(() => {
    loadSampleProject().then(onOpenInCfd, (err: unknown) => {
      showError(failureText(err, "Couldn't load the sample project — it wasn't saved. Please try again."));
    });
  }, [loadSampleProject, onOpenInCfd, showError]);

  // The welcome panel's Load Sample Project (v0.19.0): focus moves to the
  // toolbar's Load Sample first. The insert unmounts the panel, and focus
  // would sit on <body> while the save is pending and after a failed one
  // rolls back (Opus-R1b-1 -12).
  const handlePanelLoadSample = useCallback(() => {
    loadSampleButtonRef.current?.focus();
    handleLoadSample();
  }, [handleLoadSample]);

  // A clone's words, after a macrotask (DASH26 R1b F5): the region is emptied
  // first (in handleClone, and by every failure), so the same words twice are
  // announced twice. The macrotask is a margin, not load-bearing today: the
  // click's own update commits the empty before the clone's asynchronous
  // refill can land (a mutant without it passed every test; equivalent by
  // reading). It guards a future path that empties and refills in one run.
  const announceClone = useCallback((text: string) => {
    window.clearTimeout(cloneStatusTimer.current);
    cloneStatusTimer.current = window.setTimeout(() => setCloneStatus(text), 0);
  }, []);

  // v0.19.0 (DASH26 R1b): Clone. The open project stays open (O18) and focus
  // stays on Clone. What it copies is cloneSource's choice (O20).
  const handleClone = useCallback(async (id: string) => {
    window.clearTimeout(cloneStatusTimer.current);
    setCloneStatus('');
    const shown = projects.find((p) => p.id === id)?.name || UNNAMED_PROJECT;
    const source = await cloneSource(loadedProject, id, driver);
    if (!source) {
      showError(cloneFailedText(shown));
      return;
    }
    cloneProject(source).then(
      ({ name }) => announceClone(`Cloned "${shown}" as "${name}".`),
      (err: unknown) => showError(failureText(err, cloneFailedText(shown))),
    );
  }, [projects, loadedProject, driver, cloneProject, announceClone, showError]);

  const handleExport = useCallback(async (id: string) => {
    const project = await driver.loadProject(id);
    if (!project) return;
    const json = driver.exportProject(project);
    downloadFile(json, exportFilename(project.name, 'json'), 'application/json');
  }, [driver]);

  const handleExportAll = useCallback(async () => {
    const allProjects = (await Promise.all(
      projects.map((p) => driver.loadProject(p.id))
    )).filter((p): p is NonNullable<typeof p> => p !== null);
    if (allProjects.length === 0) return;
    // v0.12.2 (M-3): route each project through driver.exportProject()
    // so cloud-only fields (owner, members, schemaVersion, _originRef,
    // _changeLog) are stripped before the file is written. Round-trip
    // through JSON.parse so the array element shape matches the
    // single-project exporter at handleExport above; the per-project
    // exportProject call is what does the actual stripping.
    const exported = allProjects.map((p) => JSON.parse(driver.exportProject(p)));
    const json = JSON.stringify(exported, null, 2);
    downloadFile(json, exportAllFilename('json'), 'application/json');
  }, [projects, driver]);

  // v0.19.0 (DASH26 R10): the last project may be deleted, like any other.
  // The last-project rule (since v0.1.0) is gone; an emptied list shows the
  // welcome panel, and focus goes to New Project (O12).
  const handleDeleteClick = useCallback((id: string) => setDeleteConfirmId(id), []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirmId) {
      // The shown list (v0.21.0, O61): a hidden neighbour cannot take focus.
      const target = focusAfterTileLeaves(shown, deleteConfirmId);
      deleteProject(deleteConfirmId);
      setFocusRequest({ target });
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteProject, shown]);

  const handleCancelDelete = useCallback(() => {
    if (deleteConfirmId) setFocusRequest({ target: { kind: 'delete', projectId: deleteConfirmId } });
    setDeleteConfirmId(null);
  }, [deleteConfirmId]);

  const deleteTargetName =
    projects.find((p) => p.id === deleteConfirmId)?.name ?? '';

  return (
    // v0.22.0 (FRAME26): the collection under the frame, in `main`. The page
    // scrolls, not this (until v0.22.0 it was its own scroll area). Block flow,
    // not a flex gap, so each row's own top margin is the gap: the frame's
    // 16 px (`.sf-below`, `.sf-tiles`) and the empty panels' 24 px.
    <div ref={rootRef}>
      {/* The frame's heading row: "Projects", the page's h1, and the toolbar,
          the same order as across the SPERT suite (v0.17.0). Every button is
          always rendered; none moves with the project count or a load. Each
          is the frame's 36 px `.sf-btn` (contract §2), its colours and
          corners its own. Deliberately NOT role="toolbar": that role promises
          arrow-key navigation, and nothing here provides it. */}
      <HeadingRow
        toolbar={
          <>
            <div className="sf-toolbar" data-sf="toolbar">
              <button
                type="button"
                onClick={handleExportAll}
                disabled={projects.length === 0}
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
                ref={loadSampleButtonRef}
                type="button"
                onClick={handleLoadSample}
                className={SECONDARY}
              >
                <ToolbarIcon d={TOOLBAR_ICON_PATHS.sample} className={TOOLBAR_ICON_SECONDARY} />
                Load Sample
              </button>
              <button
                ref={newProjectButtonRef}
                type="button"
                onClick={() => setDialog({ kind: 'new' })}
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
        }
      >
        Projects
      </HeadingRow>

      <ArchiveRows
        archivedCount={archiveView.archivedCount}
        showArchived={archiveView.showArchived}
        onShowArchivedChange={archiveView.setShowArchived}
        unread={archiveView.read.status === 'failed'}
        status={archiveView.status}
      />

      {/* A failed create, Load Sample or Clone (v0.19.0: storage full in O24's words) */}
      {uiError && (
        <div role="alert" className="sf-below flex items-center justify-between rounded bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-700 dark:text-red-100">
          <span>{uiError}</span>
          <button
            onClick={() => setUiError(null)}
            className="ml-4 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* v0.19.0 (DASH26 O19, Q3): Clone's words. The status region is always
          mounted, so its first message is announced, and sr-only, so an
          empty one takes no space in this column (+16 px measured with a
          visible empty one). The visible line repeats the words, hidden
          from screen readers so they are read once, beside a Dismiss that
          stays reachable; it renders only while there is text. */}
      <div role="status" aria-live="polite" className="sr-only" data-clone-status="">
        {cloneStatus}
      </div>
      {cloneStatus && (
        <div className="sf-below flex items-center justify-between rounded bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-100">
          <span aria-hidden="true">{cloneStatus}</span>
          <button
            type="button"
            onClick={() => {
              // DASH26 O25 (PR #109 review -05, G5): this button unmounts with
              // its line, so focus goes to the toolbar's New Project first,
              // never to <body>.
              newProjectButtonRef.current?.focus();
              setCloneStatus('');
            }}
            aria-label="Dismiss clone message"
            className="ml-4 text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import error phase */}
      {importFlowPhase.phase === 'error' && (
        <div
          role="alert"
          className="sf-below flex items-center justify-between rounded bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-700 dark:text-red-100"
        >
          <span>{importFlowPhase.message}</span>
          <button
            onClick={onDismissImportBanner}
            className="ml-4 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import success banner */}
      {importFlowPhase.phase === 'banner' && (
        <div
          role="status"
          className="sf-below flex items-center justify-between rounded bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-100"
        >
          <span>{buildBannerText(importFlowPhase.outcome)}</span>
          <button
            onClick={onDismissImportBanner}
            className="ml-4 text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import preview */}
      {importFlowPhase.phase === 'preview' && (
        <div className="sf-below">
          <ImportPreviewSection
            incoming={importFlowPhase.incoming}
            conflicts={importFlowPhase.conflicts}
            decisions={importFlowPhase.decisions}
            applying={importApplying}
            driverLoading={driverLoading}
            existingCount={projects.length}
            onSetDecision={setImportDecision}
            onConfirm={onConfirmImport}
            onCancel={onCancelImport}
          />
        </div>
      )}

      {/* Project grid (v0.18.0: SPERT® Forecaster's tiles and grid). With no
          projects (v0.19.0, DASH26 R11, O21): Forecaster's pending line while
          the cloud list loads, else the welcome panel once it has loaded,
          unless an import preview is open. 24 px below the row above, as
          Forecaster's mt-6 sections. The welcome panel and the all-archived
          line stand in for the tile grid, so they carry the frame's
          `data-sf="empty"` (contract §7); their place stays v0.19.0's. */}
      {projects.length === 0 ? (
        driverLoading ? (
          <p role="status" aria-live="polite" className="mt-6 text-sm text-[#666] dark:text-gray-400">
            {CLOUD_PENDING_TEXT}
          </p>
        ) : importFlowPhase.phase !== 'preview' && (
          <div className="mt-6" data-sf="empty">
            <ProjectsEmptyState onCreateNew={() => setDialog({ kind: 'new' })} onLoadSample={handlePanelLoadSample} />
          </div>
        )
      ) : (
        <ProjectGrid
          sensors={sensors}
          onDragEnd={handleDragEnd}
          shown={shown}
          stats={projectStats}
          mode={driver.mode}
          view={archiveView}
          onExport={handleExport}
          onEdit={handleEdit}
          onShare={setSharingProjectId}
          onClone={handleClone}
          onDelete={handleDeleteClick}
        />
      )}

      {/* The one project dialog, New or Edit (v0.18.0). Keyed by identity, so a
          different project's Edit starts a fresh form. Its DOM goes to
          document.body. */}
      {dialog && (
        <ProjectDialog
          key={dialog.kind === 'edit' ? dialog.projectId : 'new'}
          identity={dialog.kind === 'edit' ? dialog.projectId : 'new'}
          title={dialog.kind === 'edit' ? 'Edit Project' : 'New Project'}
          initialName={dialog.kind === 'edit' ? dialog.name : ''}
          submitLabel={dialog.kind === 'edit' ? 'Update' : 'Create'}
          onSubmit={dialog.kind === 'edit' ? handleUpdate : handleCreate}
          onCancel={closeDialog}
          returnFocusTo={returnFocusFromDialog}
        />
      )}

      {/* Sharing modal */}
      {sharingProjectId && (
        <SharingModal
          projectId={sharingProjectId}
          onClose={() => setSharingProjectId(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <ConfirmDialog
          title="Delete Project"
          message={`Delete "${deleteTargetName}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {/* Replace-confirm gate for imports */}
      {importFlowPhase.phase === 'replace-confirm' && (
        <ConfirmDialog
          title="Replace projects?"
          message="One or more projects in your workspace will be overwritten by the import. This cannot be undone."
          confirmLabel="Replace"
          variant="danger"
          onConfirm={onReplaceConfirmed}
          onCancel={onDismissReplaceConfirm}
        />
      )}
    </div>
  );
}

/** The grid of shown tiles (v0.21.0: archived ones only with "Show archived"); dnd-kit sorts these and no others. */
function ProjectGrid({
  sensors,
  onDragEnd,
  shown,
  stats,
  mode,
  view,
  onExport,
  onEdit,
  onShare,
  onClone,
  onDelete,
}: {
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  shown: ProjectListItem[];
  stats: Map<string, ProjectStats>;
  mode: StorageMode;
  view: ReturnType<typeof useProjectArchive>;
  onExport: (id: string) => void;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Every project archived and the filter off: this line, never the welcome panel (O50).
  if (shown.length === 0) return <AllArchivedLine count={view.archivedCount} />;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((p) => p.id)} strategy={rectSortingStrategy}>
        {/* The frame's tile grid (contract §3): 340 px minimum columns, 16 px
            gaps, 16 px below the row above (3 columns at 1280 and 1440, 4 at
            1920). Until v0.22.0 it was a container-query grid of 1 to 3. */}
        <ul className="sf-tiles" data-sf="tiles" aria-label="Projects">
          {shown.map((p) => {
            const pref = view.prefOf(p.id);
            return (
              <SortableProjectTile
                key={p.id}
                id={p.id}
                name={p.name}
                stats={stats.get(p.id)}
                access={tileAccess(mode, p.role, p.memberCount)}
                onOpen={view.openProject}
                onExport={onExport}
                onEdit={onEdit}
                onShare={onShare}
                onClone={onClone}
                onDelete={onDelete}
                color={pref.color}
                archived={pref.archived === true}
                prefsBlockedReason={view.blockedReason(p.id)}
                dragBlockedReason={view.dragBlockedReason}
                colorOpen={view.colorOpenFor === p.id}
                onColorOpenChange={view.setColorOpen}
                onPickColor={view.pickColor}
                onArchive={view.archive}
                onUnarchive={view.unarchive}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
