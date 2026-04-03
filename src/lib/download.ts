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

/** YYYYMMDD-HHmmss in local time. */
function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Export filename: spert-cfd-<project>-<timestamp>.<ext> */
export function exportFilename(projectName: string, ext: string): string {
  return `spert-cfd-${sanitizeFilename(projectName)}-${timestamp()}.${ext}`;
}

/** Export-all filename: spert-cfd-<timestamp>.<ext> */
export function exportAllFilename(ext: string): string {
  return `spert-cfd-${timestamp()}.${ext}`;
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
