// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useRef } from 'react';
import { useEscapeKey } from '@/lib/use-dismiss';
import { TOS_URL, PRIVACY_URL } from '@/lib/constants';
import { X } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

export function ConsentModal({ onAccept, onCancel }: ConsentModalProps) {
  const [agreed, setAgreed] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onCancel);

  // Focus modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white shadow-xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-modal-title"
        aria-describedby="consent-modal-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="consent-modal-title" className="text-sm font-semibold">
            Enable Cloud Storage
          </h2>
          <button
            onClick={onCancel}
            className="rounded p-1 text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
          <p id="consent-modal-description" className="text-sm text-gray-600">
            Cloud Storage stores your project planning data in
            Firebase/Firestore on Google Cloud. Use is governed by the
            Statistical PERT&reg;{' '}
            <a
              href={TOS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700"
            >
              Terms of Service
            </a>
            {' '}and{' '}
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700"
            >
              Privacy Policy
            </a>
            .
          </p>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have read and agree to the Terms of Service and Privacy Policy.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={!agreed}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Enable Cloud Storage
          </button>
        </div>
      </div>
    </div>
  );
}
