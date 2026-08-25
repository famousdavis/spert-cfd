// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';
import { MAX_NAME_LENGTH } from '@/lib/constants';

/** Rendered in place of a date when no instant is recoverable. Owner-chosen. */
const UPDATED_AT_FALLBACK = '\u2014';

export interface ProjectStats {
  snapshotCount: number;
  workflowStateCount: number;
  /** ISO 8601, or absent when the stored value carried no recoverable instant. */
  updatedAt?: string;
  memberCount?: number;
  isOwner?: boolean;
}

interface ProjectCardProps {
  id: string;
  name: string;
  stats: ProjectStats | undefined;
  isActive: boolean;
  onOpen: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onShare?: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

// Exported for PC-1 layer 2 (Brief 19), which renders it directly: the
// Sortable wrapper needs a DndContext that contributes nothing to the
// assertion. Behaviour is unchanged — SortableProjectCard is still the only
// thing the app mounts.
export function ProjectCard({
  id,
  name,
  stats,
  isActive,
  onOpen,
  onExport,
  onDelete,
  onRename,
  onShare,
  dragHandleProps,
  isDragging,
}: ProjectCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');

  const handleStartRename = () => {
    setRenameName(name);
    setIsRenaming(true);
  };

  const handleRenameCommit = () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  // TWO distinct no-render cases, deliberately NOT collapsed into one guard.
  //   stats == null                  -> stats have not loaded  -> null -> NBSP
  //   stats present, updatedAt unset -> no recoverable instant -> UPDATED_AT_FALLBACK
  // Collapsing them would render "Updated —" for a project whose stats merely
  // have not loaded yet, which is a false claim about the data. The em dash has
  // to travel THROUGH formattedDate: it is a truthy string, so the `Updated ${}`
  // template below fires. Landing it in the falsy branch instead renders a bare
  // dash with no "Updated", or a bare NBSP.
  const formattedDate = stats
    ? stats.updatedAt
      ? format(new Date(stats.updatedAt), 'MMM d, yyyy')
      : UPDATED_AT_FALLBACK
    : null;

  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${
        isActive
          ? 'border-blue-300 bg-blue-50'
          : 'border-gray-200 bg-white'
      } ${isDragging ? 'shadow-lg ring-2 ring-blue-400 opacity-90' : ''}`}
    >
      {/* Header: drag handle + name + active badge */}
      <div className="flex items-start gap-2 min-w-0">
        <span
          {...dragHandleProps}
          className="mt-0.5 shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing select-none"
          aria-label="Drag to reorder"
        >
          ⠿
        </span>
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                id={`project-rename-${id}`}
                name={`project-rename-${id}`}
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                maxLength={MAX_NAME_LENGTH}
                aria-label="Rename project"
                autoComplete="off"
                className="rounded border border-gray-300 px-2 py-1 text-sm flex-1 min-w-0"
                autoFocus
              />
              <button
                onClick={handleRenameCommit}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsRenaming(false)}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{name}</span>
              {isActive && (
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Active
                </span>
              )}
              {stats?.memberCount && stats.memberCount > 1 && (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Shared
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-1 ml-6 text-xs text-gray-400">
        {stats
          ? `${stats.snapshotCount} snapshot${stats.snapshotCount !== 1 ? 's' : ''} · ${stats.workflowStateCount} state${stats.workflowStateCount !== 1 ? 's' : ''}`
          : 'Loading…'}
      </div>
      <div className="mt-0.5 ml-6 text-xs text-gray-400">
        {formattedDate ? `Updated ${formattedDate}` : '\u00A0'}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onOpen(id)}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
        >
          Open
        </button>
        <button
          onClick={() => onExport(id)}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
        >
          Export
        </button>
        {onShare && (
          <button
            onClick={() => onShare(id)}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            Share
          </button>
        )}
        <button
          onClick={handleStartRename}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
        >
          Rename
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onDelete(id)}
          className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete project"
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Sortable wrapper
type SortableProjectCardProps = Omit<ProjectCardProps, 'dragHandleProps' | 'isDragging'>;

export function SortableProjectCard(props: SortableProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ProjectCard
        {...props}
        dragHandleProps={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}
