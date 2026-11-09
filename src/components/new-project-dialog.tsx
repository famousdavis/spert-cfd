// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeKey } from '@/lib/use-dismiss';
import { MAX_NAME_LENGTH } from '@/lib/constants';

interface NewProjectDialogProps {
  /** Called with the trimmed, non-blank name. */
  onCreate: (name: string) => void;
  onCancel: () => void;
}

/**
 * v0.17.0: asks for the new project's name. Replaces the inline New Project
 * section of the Projects tab. The shell follows ConfirmDialog; the caller
 * returns focus to the New Project button when this closes.
 */
export function NewProjectDialog({ onCreate, onCancel }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  useEscapeKey(onCancel);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmed) return;
    onCreate(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-sm rounded-lg bg-white shadow-xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-dialog-title"
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 id="new-project-dialog-title" className="text-sm font-semibold">
              New Project
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="rounded p-1 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <label htmlFor="new-project-name" className="mb-1 block text-xs font-medium text-gray-700">
              Project name
            </label>
            <input
              id="new-project-name"
              name="new-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              autoFocus
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
