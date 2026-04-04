// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';

export function AppHeader() {
  const { mode } = useStorage();
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
      <h1 className="text-lg font-bold whitespace-nowrap">
        SPERT<sup className="text-[0.5em] text-gray-400 font-normal">®</sup> CFD
      </h1>

      <div className="flex items-center gap-2">
        {mode === 'cloud' && (
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            Cloud
          </span>
        )}
        {user && (
          <span className="text-xs text-gray-500 truncate max-w-[160px]">
            {user.displayName ?? user.email}
          </span>
        )}
      </div>
    </header>
  );
}
