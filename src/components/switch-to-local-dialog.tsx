// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '@/lib/use-dismiss';
import { X } from 'lucide-react';

interface SwitchToLocalDialogProps {
  projectCount: number;
  onKeepLocalCopy: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}

export function SwitchToLocalDialog({
  projectCount,
  onKeepLocalCopy,
  onDiscard,
  onCancel,
}: SwitchToLocalDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  useEscapeKey(() => {
    if (!copying) onCancel();
  });

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleKeep = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await onKeepLocalCopy();
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white shadow-xl outline-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="switch-to-local-title"
        aria-describedby="switch-to-local-message"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="switch-to-local-title" className="text-sm font-semibold">
            Switch to Local Storage
          </h2>
          <button
            onClick={onCancel}
            disabled={copying}
            className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <p id="switch-to-local-message" className="mb-2 text-sm text-gray-700">
            You have <strong>{projectCount}</strong> cloud project
            {projectCount !== 1 ? 's' : ''}. Keep a local copy before
            switching, or discard and switch?
          </p>
          <p className="text-xs text-gray-500">
            <strong>Keep Local Copy</strong> copies your cloud projects into
            this browser. <strong>Discard</strong> leaves them in the cloud
            (accessible on re-sign-in) but clears this browser&apos;s
            active-project pointer.
          </p>
          {copying && (
            <p className="mt-3 text-xs text-blue-700">Copying projects…</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onCancel}
            disabled={copying}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            disabled={copying}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Discard
          </button>
          <button
            onClick={handleKeep}
            disabled={copying}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copying ? 'Copying…' : 'Keep Local Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
