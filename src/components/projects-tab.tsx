// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
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
import { loadProject, exportProject } from '@/lib/storage';
import { exportFilename, exportAllFilename, downloadFile } from '@/lib/download';
import { MAX_IMPORT_FILE_SIZE, MAX_NAME_LENGTH } from '@/lib/constants';
import { ConfirmDialog } from './confirm-dialog';
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
    importProjectFromJson,
    reorderProjects,
  } = useProjectList();

  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

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

  // Load full project data for stats — memoized keyed on projects array reference
  const projectStats = useMemo(() => {
    const map = new Map<string, ProjectStats>();
    for (const p of projects) {
      const full = loadProject(p.id);
      if (full) {
        map.set(p.id, {
          snapshotCount: full.snapshots.length,
          workflowStateCount: full.workflow.length,
          updatedAt: full.updatedAt,
        });
      }
    }
    return map;
  }, [projects]);

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    createProject(name);
    setNewName('');
  }, [newName, createProject]);

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreate();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setImportError('File too large. Maximum size is 1MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      const id = importProjectFromJson(json);
      if (!id) {
        setImportError('Invalid project file. Please check the format and try again.');
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = useCallback((id: string) => {
    const project = loadProject(id);
    if (!project) return;
    const json = exportProject(project);
    downloadFile(json, exportFilename(project.name, 'json'), 'application/json');
  }, []);

  const handleExportAll = useCallback(() => {
    const allProjects = projects
      .map((p) => loadProject(p.id))
      .filter((p): p is NonNullable<typeof p> => p !== null);
    if (allProjects.length === 0) return;
    const json = JSON.stringify(allProjects, null, 2);
    downloadFile(json, exportAllFilename('json'), 'application/json');
  }, [projects]);

  const handleDeleteClick = useCallback(
    (id: string) => {
      if (projects.length <= 1) {
        setImportError('Cannot delete the last project.');
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

  const handleRename = useCallback(
    (id: string, name: string) => {
      renameProject(id, name);
    },
    [renameProject]
  );

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
          onClick={handleImportClick}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Import project file"
        />
      </div>

      {/* Error banner */}
      {importError && (
        <div className="flex items-center justify-between rounded bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New project form */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          New Project
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Project name"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <SortableProjectCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    stats={projectStats.get(p.id)}
                    isActive={p.id === activeProjectId}
                    onOpen={onOpenInCfd}
                    onExport={handleExport}
                    onDelete={handleDeleteClick}
                    onRename={handleRename}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

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
    </div>
  );
}
