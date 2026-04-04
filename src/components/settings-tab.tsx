// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

export function SettingsTab() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl mb-2 text-gray-900">Settings</h2>
        <p className="text-gray-500 leading-relaxed">
          Cloud storage will be available in a future update. Your data is
          currently stored in this browser&apos;s localStorage.
        </p>
      </div>
    </div>
  );
}
