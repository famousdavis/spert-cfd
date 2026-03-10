// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useEffect } from 'react';
import type { WorkflowState, StateCategory } from '@/types';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { ColorPicker } from './color-picker';

interface StateRowProps {
  state: WorkflowState;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  deleteWarning: boolean;
  onRename: (name: string) => void;
  onSetColor: (color: string) => void;
  onSetCategory: (category: StateCategory) => void;
  onSetWipLimit: (limit: number | undefined) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function StateRow({
  state,
  isFirst,
  isLast,
  canDelete,
  deleteWarning,
  onRename,
  onSetColor,
  onSetCategory,
  onSetWipLimit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StateRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(state.name);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== state.name) {
      onRename(trimmed);
    } else {
      setDraftName(state.name);
    }
    setIsEditingName(false);
  };

  if (isConfirmingDelete) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-2 text-xs">
        <p className="text-red-700 mb-1.5">
          {deleteWarning
            ? `"${state.name}" has snapshot data. Delete anyway?`
            : `Delete "${state.name}"?`}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              onDelete();
              setIsConfirmingDelete(false);
            }}
            className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => setIsConfirmingDelete(false)}
            className="rounded px-2 py-0.5 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-200 bg-white p-2 space-y-1.5">
      {/* Row 1: color swatch, name, delete */}
      <div className="flex items-center gap-1.5">
        {/* Color swatch */}
        <div className="relative">
          <button
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            className="h-5 w-5 rounded border border-gray-300 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ backgroundColor: state.color }}
            aria-label={`Color for ${state.name}: ${state.color}`}
          />
          {isColorPickerOpen && (
            <ColorPicker
              value={state.color}
              onChange={onSetColor}
              onClose={() => setIsColorPickerOpen(false)}
            />
          )}
        </div>

        {/* Name */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setDraftName(state.name);
                setIsEditingName(false);
              }
            }}
            onBlur={commitName}
            className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-sm"
          />
        ) : (
          <button
            onClick={() => {
              setDraftName(state.name);
              setIsEditingName(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-sm hover:text-blue-600"
            title="Click to rename"
          >
            {state.name}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => setIsConfirmingDelete(true)}
          disabled={!canDelete}
          className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
          title={canDelete ? 'Delete state' : 'Cannot delete last state'}
          aria-label={`Delete ${state.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Row 2: category, WIP limit, reorder */}
      <div className="flex items-center gap-1.5">
        <select
          value={state.category}
          onChange={(e) => onSetCategory(e.target.value as StateCategory)}
          className="rounded border border-gray-300 px-1 py-0.5 text-xs"
          aria-label={`Category for ${state.name}`}
        >
          <option value="backlog">Backlog</option>
          <option value="active">Active</option>
          <option value="done">Done</option>
        </select>

        {state.category === 'active' && (
          <span className="flex items-center gap-0.5 text-xs text-gray-500">
            <label htmlFor={`wip-${state.id}`}>WIP:</label>
            <input
              id={`wip-${state.id}`}
              type="number"
              min={0}
              value={state.wipLimit ?? ''}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onSetWipLimit(isNaN(val) || val <= 0 ? undefined : val);
              }}
              placeholder="—"
              className="w-10 rounded border border-gray-300 px-1 py-0.5 text-xs text-center"
            />
          </span>
        )}

        <span className="flex-1" />

        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          title="Move up"
          aria-label={`Move ${state.name} up`}
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          title="Move down"
          aria-label={`Move ${state.name} down`}
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
