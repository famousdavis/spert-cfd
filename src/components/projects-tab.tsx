// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useProjectList } from '@/contexts/project-list-context';
import { useActiveProject } from '@/contexts/active-project-context';
import { useStorage } from '@/contexts/storage-context';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';
import { cloneSource } from '@/lib/clone-project';
import { isStorageFullError, STORAGE_FULL_MESSAGE } from '@/lib/storage-errors';
import { exportFilename, exportAllFilename, downloadFile } from '@/lib/download';
import { projectStats as statsOf, type ProjectStats } from '@/lib/project-tile-meta';
import { findTileControl, focusAfterTileLeaves, resolveFocusTarget, type TileFocusTarget } from '@/lib/tile-focus';
import { useImportState } from '@/hooks/use-import-state';
import { ConfirmDialog } from './confirm-dialog';
import { ErrorBoundary } from './error-boundary';
import { ViewErrorNotice } from './view-error-notice';
import { ProjectDialog } from './project-dialog';
import { ProjectsEmptyState } from './projects-empty-state';
import { ArchiveRows } from './archive-controls';
import { useProjectArchive } from './use-project-archive';
import { ImportPreviewSection } from './import-preview-section';
import { SharingModal } from './sharing-modal';
import { HeadingRow } from './heading-row';
import { ProjectGrid } from './project-grid';
import { ProjectsToolbar } from './projects-toolbar';
import { ProjectsMessages } from './projects-messages';

interface ProjectsTabProps {
  onOpenInCfd: (id: string) => void;
  /** v0.23.0 (FRAME26 clean-up L): a saved sample, opened on the CFD tab and announced by the shell. */
  onOpenSample: (sample: { id: string; name: string }) => void;
}

/** The project dialog: New Project, or Edit for one project, by id. */
type DialogState = { kind: 'new' } | { kind: 'edit'; projectId: string; name: string } | null;

/** Forecaster's pending line while the first cloud load is out (DASH26 O21). */
export const CLOUD_PENDING_TEXT = 'Loading your cloud projects — import will be available shortly.';

/** O24's words for a refused local save, else the action's own. */
function failureText(err: unknown, own: string): string {
  return isStorageFullError(err) ? STORAGE_FULL_MESSAGE : own;
}

const cloneFailedText = (name: string) => `Couldn't clone "${name}" — the copy wasn't saved. Please try again.`;

export function ProjectsTab({ onOpenInCfd, onOpenSample }: ProjectsTabProps) {
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
  // opens a project once it is saved. v0.23.0 (FRAME26 clean-up L): the one
  // handler for the toolbar's Load Sample and the Welcome panel's; a repeat is
  // numbered, and the shell announces the sample it opened.
  const handleLoadSample = useCallback(() => {
    loadSampleProject().then(onOpenSample, (err: unknown) => {
      showError(failureText(err, "Couldn't load the sample project — it wasn't saved. Please try again."));
    });
  }, [loadSampleProject, onOpenSample, showError]);

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
    // 16 px (`.sf-below`, `.sf-tiles`, `.sf-empty`) and the cloud pending
    // line's 24 px.
    <div ref={rootRef}>
      {/* The frame's heading row: "Projects", the page's h1, and the toolbar,
          the same order as across the SPERT suite (v0.17.0). Every button is
          always rendered; none moves with the project count or a load. Each
          is the frame's 36 px `.sf-btn` (contract §2), its colours and
          corners its own. Deliberately NOT role="toolbar": that role promises
          arrow-key navigation, and nothing here provides it. */}
      <HeadingRow
        toolbar={
          <ProjectsToolbar
            projectCount={projects.length}
            driverLoading={driverLoading}
            onExportAll={handleExportAll}
            onImportClick={onImportClick}
            onLoadSample={handleLoadSample}
            onNewProject={() => setDialog({ kind: 'new' })}
            loadSampleRef={loadSampleButtonRef}
            newProjectRef={newProjectButtonRef}
            importInputRef={importInputRef}
            onImportFileChange={onImportFileChange}
          />
        }
      >
        Projects
      </HeadingRow>

      {/* v0.23.0 (FRAME26 clean-up C17): everything below the heading row has
          its own boundary, so a view that fails (a tile, the grid, the
          Welcome panel, a dialog) leaves the page's h1 and the four buttons
          in place, as the CFD tab, Settings and About keep theirs. The shell's
          boundary around the whole tab stays, for a failure in this
          component's own state. */}
      <ErrorBoundary fallback={<ViewErrorNotice />}>
        <ArchiveRows
          archivedCount={archiveView.archivedCount}
          showArchived={archiveView.showArchived}
          onShowArchivedChange={archiveView.setShowArchived}
          unread={archiveView.read.status === 'failed'}
          status={archiveView.status}
        />

        <ProjectsMessages
          uiError={uiError}
          onDismissUiError={() => setUiError(null)}
          cloneStatus={cloneStatus}
          onDismissClone={() => {
            // DASH26 O25 (PR #109 review -05, G5): this button unmounts with
            // its line, so focus goes to the toolbar's New Project first,
            // never to <body>.
            newProjectButtonRef.current?.focus();
            setCloneStatus('');
          }}
          importFlowPhase={importFlowPhase}
          onDismissImportBanner={onDismissImportBanner}
        />

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
            unless an import preview is open. The pending line sits 24 px below
            the row above, as Forecaster's mt-6 sections. The Welcome panel and
            the all-archived line stand in for the tile grid, so they carry the
            frame's `data-sf="empty"` (contract §7) and sit 16 px below the row
            above, as the grid does (v0.23.0: `.sf-empty`, `.sf-below`). */}
        {projects.length === 0 ? (
          driverLoading ? (
            <p role="status" aria-live="polite" className="mt-6 text-sm text-[#666] dark:text-gray-400">
              {CLOUD_PENDING_TEXT}
            </p>
          ) : importFlowPhase.phase !== 'preview' && (
            <ProjectsEmptyState onCreateNew={() => setDialog({ kind: 'new' })} onLoadSample={handlePanelLoadSample} />
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
      </ErrorBoundary>
    </div>
  );
}
