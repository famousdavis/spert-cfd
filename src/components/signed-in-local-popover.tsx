// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useEscapeKey } from '@/lib/use-dismiss';

interface SignedInLocalPopoverProps {
  firstName: string;
  email: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSignOut: () => Promise<void>;
  /**
   * Navigate the user to Settings (where the Cloud Storage radio lives).
   * This action MUST NOT call switchMode('cloud') directly — the
   * mode-toggle click in Settings is the intended UX because it fires
   * the local → cloud migration prompt in a tab the user is actively
   * viewing.
   */
  onSwitchToCloudStorage: () => void;
}

export function SignedInLocalPopover({
  firstName,
  email,
  anchorRef,
  onClose,
  onSignOut,
  onSwitchToCloudStorage,
}: SignedInLocalPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [signingOut, setSigningOut] = useState(false);

  const guardedClose = useCallback(() => {
    if (signingOut) return;
    onClose();
  }, [signingOut, onClose]);

  useEscapeKey(guardedClose);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (signingOut) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [signingOut, onClose, anchorRef]);

  const handleSwitch = () => {
    if (signingOut) return;
    onSwitchToCloudStorage();
    onClose();
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
      onClose();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Account"
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <div className="px-4 py-3">
        <div className="truncate text-sm font-semibold text-gray-900">{firstName}</div>
        {email && <div className="truncate text-xs text-gray-500">{email}</div>}
      </div>
      <div className="border-t border-gray-200" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <button
          type="button"
          onClick={handleSwitch}
          disabled={signingOut}
          className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Switch to Cloud Storage
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="rounded border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <button
          type="button"
          onClick={guardedClose}
          disabled={signingOut}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
