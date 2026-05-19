// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { useProjectList } from '@/contexts/project-list-context';
import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';
import { exportFilename, exportAllFilename, downloadFile } from '@/lib/download';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { buildBannerText } from '@/lib/import-utils';
import { useImportState } from '@/hooks/use-import-state';
import { ConfirmDialog } from './confirm-dialog';
import { ImportPreviewSection } from './import-preview-section';
import { SharingModal } from './sharing-modal';
import { SortableProjectCard, type ProjectStats } from './project-row';

interface ProjectsTabProps {
  onOpenInCfd: (id: string) => void;
}

export function ProjectsTab({ onOpenInCfd }: ProjectsTabProps) {
  const {
    projects,
    activeProjectId,
    createProject,
    deleteProject,
    renameProject,
    reorderProjects,
  } = useProjectList();
  const { driver } = useStorage();
  const { user } = useAuth();

  const [newName, setNewName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState<Map<string, ProjectStats>>(new Map());
  const [uiError, setUiError] = useState<string | null>(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const projectIds = projects.map((p) => p.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = projectIds.indexOf(active.id as string);
      const newIndex = projectIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(projectIds, oldIndex, newIndex);
      reorderProjects(reordered);
    },
    [projectIds, reorderProjects]
  );

  // Load full project data for stats via driver (async)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, ProjectStats>();
      for (const p of projects) {
        const full = await driver.loadProject(p.id);
        if (full) {
          map.set(p.id, {
            snapshotCount: full.snapshots.length,
            workflowStateCount: full.workflow.length,
            updatedAt: full.updatedAt,
            memberCount: full.members ? Object.keys(full.members).length : undefined,
            isOwner: !!user && full.owner === user.uid,
          });
        }
      }
      if (!cancelled) setProjectStats(map);
    })();
    return () => { cancelled = true; };
  }, [projects, driver, user]);

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    createProject(name);
    setNewName('');
  }, [newName, createProject]);

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreate();
  };

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

  const handleDeleteClick = useCallback(
    (id: string) => {
      if (projects.length <= 1) {
        setUiError('Cannot delete the last project.');
        return;
      }
      setDeleteConfirmId(id);
    },
    [projects.length]
  );

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirmId) {
      deleteProject(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteProject]);

  const deleteTargetName =
    projects.find((p) => p.id === deleteConfirmId)?.name ?? '';

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 mx-auto w-full max-w-4xl">
      {/* Top action row */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleExportAll}
          disabled={projects.length === 0}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Export All
        </button>
        <button
          onClick={onImportClick}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
        >
          Import
        </button>
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
      </div>

      {/* Non-import UI error (e.g. last-project delete) */}
      {uiError && (
        <div role="alert" className="flex items-center justify-between rounded bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{uiError}</span>
          <button
            onClick={() => setUiError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import error phase */}
      {importFlowPhase.phase === 'error' && (
        <div
          role="alert"
          className="flex items-center justify-between rounded bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          <span>{importFlowPhase.message}</span>
          <button
            onClick={onDismissImportBanner}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import success banner */}
      {importFlowPhase.phase === 'banner' && (
        <div
          role="status"
          className="flex items-center justify-between rounded bg-green-50 px-4 py-2 text-sm text-green-700"
        >
          <span>{buildBannerText(importFlowPhase.outcome)}</span>
          <button
            onClick={onDismissImportBanner}
            className="ml-4 text-green-600 hover:text-green-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import preview */}
      {importFlowPhase.phase === 'preview' && (
        <ImportPreviewSection
          incoming={importFlowPhase.incoming}
          conflicts={importFlowPhase.conflicts}
          decisions={importFlowPhase.decisions}
          applying={importApplying}
          onSetDecision={setImportDecision}
          onConfirm={onConfirmImport}
          onCancel={onCancelImport}
        />
      )}

      {/* New project form */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          New Project
        </h2>
        <div className="flex gap-2">
          <input
            id="new-project-name"
            name="new-project-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Project name"
            aria-label="New project name"
            autoComplete="off"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </section>

      {/* Project list */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400">
            No projects yet. Create one above or import a JSON file.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={projectIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {projects.map((p) => (
                  <SortableProjectCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    stats={projectStats.get(p.id)}
                    isActive={p.id === activeProjectId}
                    onOpen={onOpenInCfd}
                    onExport={handleExport}
                    onShare={driver.mode === 'cloud' && projectStats.get(p.id)?.isOwner ? (id: string) => setSharingProjectId(id) : undefined}
                    onDelete={handleDeleteClick}
                    onRename={renameProject}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

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
          onCancel={() => setDeleteConfirmId(null)}
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
