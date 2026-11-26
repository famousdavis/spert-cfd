// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef } from 'react';
import { useModalEscape } from '@/lib/use-dismiss';
import { useScrollLock } from '@/lib/use-scroll-lock';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // v0.18.0 (DASH26 R1a D2): Escape closes this dialog and only it. With the
  // bubble-phase `useEscapeKey` it had, one Escape on the Delete confirmation
  // also discarded a waiting import preview, and one on a confirmation inside
  // the sharing modal also closed that modal.
  useModalEscape(onCancel);
  useScrollLock();

  // Focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 shadow-xl outline-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-4 py-3">
          <h2 id="confirm-dialog-title" className="text-sm font-semibold dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="rounded p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p id="confirm-dialog-message" className="text-sm text-gray-600 dark:text-gray-400">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t dark:border-gray-700 px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded px-3 py-1.5 text-sm ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
