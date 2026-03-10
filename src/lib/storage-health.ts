// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export const WARNING_THRESHOLD = 3 * 1024 * 1024; // 3 MB
export const CRITICAL_THRESHOLD = 4.5 * 1024 * 1024; // 4.5 MB

export type StorageStatus = 'ok' | 'warning' | 'critical';

export interface StorageUsage {
  bytes: number;
  percent: number;
  status: StorageStatus;
}

/**
 * Calculate total localStorage usage for keys matching our prefix.
 */
export function getStorageUsage(prefix = 'cfd-lab'): StorageUsage {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { bytes: 0, percent: 0, status: 'ok' };
  }

  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const value = localStorage.getItem(key) ?? '';
      totalBytes += (key.length + value.length) * 2; // UTF-16
    }
  }

  const NOMINAL_LIMIT = 5 * 1024 * 1024;
  const percent = Math.round((totalBytes / NOMINAL_LIMIT) * 100);

  let status: StorageStatus = 'ok';
  if (totalBytes >= CRITICAL_THRESHOLD) {
    status = 'critical';
  } else if (totalBytes >= WARNING_THRESHOLD) {
    status = 'warning';
  }

  return { bytes: totalBytes, percent, status };
}
