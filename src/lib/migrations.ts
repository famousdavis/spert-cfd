// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { StorageIndex, Project } from '@/types';
import { APP_VERSION } from './constants';

// ── Current versions ────────────────────────────────────

export const DATA_VERSION = APP_VERSION;

// ── Migration types ─────────────────────────────────────

type IndexMigration = {
  version: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
};

type ProjectMigration = {
  version: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
};

// ── Index migrations ────────────────────────────────────
// Each entry migrates data TO the specified version.
// They run sequentially for all versions > stored version.

const INDEX_MIGRATIONS: IndexMigration[] = [
  // No migrations needed yet for v0.1.0
  // Example for future:
  // {
  //   version: '0.2.0',
  //   migrate: (data) => {
  //     // transform data from 0.1.0 → 0.2.0
  //     return { ...data };
  //   },
  // },
];

// ── Project migrations ──────────────────────────────────

const PROJECT_MIGRATIONS: ProjectMigration[] = [
  // No migrations needed yet for v0.1.0
];

// ── Version comparison ──────────────────────────────────

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Migration runners ───────────────────────────────────

export function migrateIndex(data: Record<string, unknown>): StorageIndex {
  const fromVersion = typeof data.version === 'string' ? data.version : '0.0.0';

  const pending = INDEX_MIGRATIONS.filter(
    (m) => compareVersions(m.version, fromVersion) > 0,
  );

  if (pending.length === 0) {
    return { ...data, version: DATA_VERSION } as unknown as StorageIndex;
  }

  let current = { ...data };
  for (const migration of pending) {
    current = migration.migrate(current);
    current.version = migration.version;
  }

  current.version = DATA_VERSION;
  return current as unknown as StorageIndex;
}

export function migrateProject(data: Record<string, unknown>): Project {
  const fromVersion = typeof data._version === 'string' ? data._version : '0.0.0';

  const pending = PROJECT_MIGRATIONS.filter(
    (m) => compareVersions(m.version, fromVersion) > 0,
  );

  if (pending.length === 0) {
    return { ...data, _version: DATA_VERSION } as unknown as Project;
  }

  let current = { ...data };
  for (const migration of pending) {
    current = migration.migrate(current);
    current._version = migration.version;
  }

  current._version = DATA_VERSION;
  return current as unknown as Project;
}

export function needsIndexMigration(data: Record<string, unknown>): boolean {
  const version = typeof data.version === 'string' ? data.version : '0.0.0';
  return compareVersions(version, DATA_VERSION) < 0;
}

export function needsProjectMigration(data: Record<string, unknown>): boolean {
  const version = typeof data._version === 'string' ? data._version : '0.0.0';
  return compareVersions(version, DATA_VERSION) < 0;
}
