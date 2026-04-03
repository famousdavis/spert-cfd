// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Replace non-alphanumeric characters (except hyphens and underscores)
 * with underscores and collapse consecutive underscores.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');
}

/**
 * Build a standardized export filename: spert-cfd-<project>-<timestamp>.<ext>
 * Timestamp format: YYYYMMDD-HHmmss (local time).
 */
export function exportFilename(projectName: string, ext: string): string {
  const now = new Date();
  const ts =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}-` +
    `${String(now.getHours()).padStart(2, '0')}` +
    `${String(now.getMinutes()).padStart(2, '0')}` +
    `${String(now.getSeconds()).padStart(2, '0')}`;
  return `spert-cfd-${sanitizeFilename(projectName)}-${ts}.${ext}`;
}

/**
 * Build a standardized export filename without a project qualifier:
 * spert-cfd-<timestamp>.<ext>
 */
export function exportAllFilename(ext: string): string {
  const now = new Date();
  const ts =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}-` +
    `${String(now.getHours()).padStart(2, '0')}` +
    `${String(now.getMinutes()).padStart(2, '0')}` +
    `${String(now.getSeconds()).padStart(2, '0')}`;
  return `spert-cfd-${ts}.${ext}`;
}

/** Trigger a browser file download from in-memory content. */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
