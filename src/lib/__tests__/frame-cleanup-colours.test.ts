// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.23.0 (FRAME26 clean-up): colours the dark-partners guard lets through,
// because its allowlist passes `text-gray-400` (a dark-mode figure: 6.8:1 on
// the page) while in light it measures 2.49 to 2.60:1. Pinned at the source:
// - C15: the changelog's dates (2.60 on white) and the CFD tab's "Storage:"
//   line (2.49 on the sidebar's gray-50): now gray-500 (4.84) and gray-600
//   (7.23), gray-400 in dark (6.82 / 5.64);
// - the close "×" of the four dialogs C8 touches: gray-500 on white (4.84),
//   gray-400 on the dialogs' dark gray-800 (5.64), at least 3:1 for an icon.
// Measured on production and the local build (Clean-FC-CFD probes).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('C15', () => {
  it('the changelog date: gray-500, gray-400 in dark', () => {
    const src = read('src/app/changelog/page.tsx');
    expect(src).toContain('<span className="text-sm text-gray-500 dark:text-gray-400">{entry.date}</span>');
    expect(src).not.toMatch(/className="text-sm text-gray-400"/);
  });
  it('the Storage line: gray-600, gray-400 in dark', () => {
    const src = read('src/components/project-dashboard.tsx');
    expect(src).toContain('<div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">');
    expect(src).not.toContain('text-xs text-gray-400"');
  });
});

describe('the dialogs\' close "×"', () => {
  for (const f of ['confirm-dialog', 'consent-modal', 'cloud-storage-modal', 'switch-to-local-dialog']) {
    it(f, () => {
      const src = read(`src/components/${f}.tsx`);
      expect(src).toContain('text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200');
      expect(src).not.toMatch(/"rounded p-1 text-gray-400 /);
    });
  }
});
