// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useClickOutside } from '@/lib/use-dismiss';

export function AppHeader() {
  const { user, isAuthLoading, signInWithGoogle, signInWithMicrosoft, signOut } = useAuth();
  const [showCloudMenu, setShowCloudMenu] = useState(false);
  const cloudMenuRef = useRef<HTMLSpanElement>(null);

  useClickOutside(cloudMenuRef, useCallback(() => setShowCloudMenu(false), []));

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
      <h1 className="text-lg font-bold whitespace-nowrap">
        SPERT<sup className="text-[0.5em] text-gray-400 font-normal">®</sup> CFD
      </h1>

      {isFirebaseConfigured && !isAuthLoading && (
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-gray-500 truncate max-w-[120px]">
                {user.displayName ?? user.email}
              </span>
              <button
                onClick={signOut}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <span ref={cloudMenuRef} className="relative">
              <button
                onClick={() => setShowCloudMenu((v) => !v)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                Cloud Storage
              </button>
              {showCloudMenu && (
                <span className="absolute right-0 top-full mt-1 z-40 flex flex-col rounded border border-gray-200 bg-white shadow-lg">
                  <button
                    onClick={() => { setShowCloudMenu(false); signInWithGoogle(); }}
                    className="whitespace-nowrap px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
                  >
                    Sign in with Google
                  </button>
                  <button
                    onClick={() => { setShowCloudMenu(false); signInWithMicrosoft(); }}
                    className="whitespace-nowrap px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left border-t border-gray-100"
                  >
                    Sign in with Microsoft
                  </button>
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
