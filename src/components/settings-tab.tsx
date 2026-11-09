// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { PAGE_COLUMN } from './page-column';
import { StorageSection } from './storage-section';
import { ProjectExportSection } from './project-export-section';
import { LocalWarningSetting } from './local-warning-setting';

export function SettingsTab() {
  return (
    // Left-aligned in the page's column under the tabs; each block keeps a
    // reading width.
    <div className="flex-1 overflow-y-auto py-4">
      <div className={`${PAGE_COLUMN} *:max-w-4xl`}>
        <h2 className="text-2xl mb-6 text-gray-900">Settings</h2>

        <StorageSection />
        <ProjectExportSection />
        <LocalWarningSetting />
      </div>
    </div>
  );
}
