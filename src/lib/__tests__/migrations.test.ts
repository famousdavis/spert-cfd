// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  migrateIndex,
  migrateProject,
  needsIndexMigration,
  needsProjectMigration,
  compareVersions,
  DATA_VERSION,
} from '../migrations';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
  });

  it('returns positive when first is greater', () => {
    expect(compareVersions('0.2.0', '0.1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
  });

  it('returns negative when first is smaller', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0);
    expect(compareVersions('0.0.1', '0.1.0')).toBeLessThan(0);
  });

  it('compares patch versions correctly', () => {
    expect(compareVersions('0.1.1', '0.1.0')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.1')).toBeLessThan(0);
  });
});

describe('migrateIndex', () => {
  it('returns data unchanged when already at current version', () => {
    const data = {
      version: DATA_VERSION,
      activeProjectId: 'abc',
      projectIds: ['abc', 'def'],
    };
    const result = migrateIndex(data);
    expect(result.version).toBe(DATA_VERSION);
    expect(result.activeProjectId).toBe('abc');
    expect(result.projectIds).toEqual(['abc', 'def']);
  });

  it('stamps current version on data with old version', () => {
    const data = { version: '0.0.0', activeProjectId: 'old', projectIds: ['old'] };
    const result = migrateIndex(data);
    expect(result.version).toBe(DATA_VERSION);
    expect(result.activeProjectId).toBe('old');
    expect(result.projectIds).toEqual(['old']);
  });

  it('handles missing version field', () => {
    const data = { activeProjectId: null, projectIds: [] };
    const result = migrateIndex(data as Record<string, unknown>);
    expect(result.version).toBe(DATA_VERSION);
  });

  it('handles legacy numeric version by treating as missing', () => {
    const data = { version: 1, activeProjectId: 'x', projectIds: ['x'] };
    const result = migrateIndex(data as unknown as Record<string, unknown>);
    expect(result.version).toBe(DATA_VERSION);
  });
});

describe('migrateProject', () => {
  it('returns data unchanged when already at current version', () => {
    const data = {
      _version: DATA_VERSION,
      id: 'proj1',
      name: 'Test Project',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      workflow: [],
      snapshots: [],
      settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
    };
    const result = migrateProject(data);
    expect(result.id).toBe('proj1');
    expect(result.name).toBe('Test Project');
  });

  it('stamps version on legacy projects without _version', () => {
    const data = {
      id: 'legacy',
      name: 'Legacy Project',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      workflow: [],
      snapshots: [],
      settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
    };
    const result = migrateProject(data as Record<string, unknown>);
    expect((result as unknown as Record<string, unknown>)._version).toBe(DATA_VERSION);
    expect(result.name).toBe('Legacy Project');
  });
});

describe('needsIndexMigration', () => {
  it('returns false when at current version', () => {
    expect(needsIndexMigration({ version: DATA_VERSION })).toBe(false);
  });

  it('returns true when below current version', () => {
    expect(needsIndexMigration({ version: '0.0.0' })).toBe(true);
  });

  it('returns true when version is missing', () => {
    expect(needsIndexMigration({})).toBe(true);
  });

  it('returns true when version is a legacy number', () => {
    expect(needsIndexMigration({ version: 1 })).toBe(true);
  });
});

describe('needsProjectMigration', () => {
  it('returns false when at current version', () => {
    expect(needsProjectMigration({ _version: DATA_VERSION })).toBe(false);
  });

  it('returns true when below current version', () => {
    expect(needsProjectMigration({ _version: '0.0.0' })).toBe(true);
  });

  it('returns true when _version is missing', () => {
    expect(needsProjectMigration({})).toBe(true);
  });
});
