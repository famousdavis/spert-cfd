// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { StorageSection } from './storage-section';
import { ProjectExportSection } from './project-export-section';
import { LocalWarningSetting } from './local-warning-setting';

export function SettingsTab() {
  return (
    // v0.22.0 (FRAME26): the body under the frame's heading row ("Settings",
    // the page's h1, rendered by AppShell), in X4's capped column. The page
    // scrolls, not this; each block keeps its reading width.
    <div className="*:max-w-4xl">
      <StorageSection />
      <ProjectExportSection />
      <LocalWarningSetting />
    </div>
  );
}
