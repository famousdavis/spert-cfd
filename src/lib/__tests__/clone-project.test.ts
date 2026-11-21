// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.19.0 (DASH26 R1b §2.1, R15, O10, O20): what a Clone copies, and its name.

import { describe, it, expect, vi } from 'vitest';
import type { Project } from '@/types';
import { buildClone, cloneName, cloneSource } from '../clone-project';
import { MAX_NAME_LENGTH } from '../constants';

const source: Project = {
  id: 'src00001',
  name: 'Alpha',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-02-01T00:00:00.000Z',
  workflow: [{ id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
  snapshots: [{ date: '2026-06-01', counts: { backlog: 3 } }],
  settings: { gridSortNewestFirst: false, showWipWarnings: false, metricsPeriod: { kind: 'all' } },
  _version: '0.13.1',
  owner: 'uid-owner',
  members: { 'uid-owner': 'owner', 'uid-me': 'viewer' },
  schemaVersion: '0.7.0',
  _originRef: 'uid-owner',
  _storageRef: 'ws-1',
  _changeLog: [{ action: 'created', timestamp: 't0', actor: 'uid-owner' }],
};
const NOW = '2026-11-21T19:00:00.000Z';

describe('buildClone', () => {
  it('an allowlist: the content, a new id and name, now; nothing else from the source', () => {
    const clone = buildClone(source, { id: 'new00001', name: 'Alpha (copy)', now: NOW });
    expect(clone).toEqual({
      id: 'new00001', name: 'Alpha (copy)', createdAt: NOW, updatedAt: NOW,
      workflow: source.workflow, snapshots: source.snapshots, settings: source.settings,
    });
  });

  it('a deep copy: the clone shares no array or object with its source', () => {
    const clone = buildClone(source, { id: 'n', name: 'n', now: NOW });
    expect(clone.workflow).not.toBe(source.workflow);
    expect(clone.snapshots[0]).not.toBe(source.snapshots[0]);
    expect(clone.settings.metricsPeriod).not.toBe(source.settings.metricsPeriod);
  });

  it('cloud: exactly one history entry, \'cloned\', by the cloner, naming the source (O10)', () => {
    const clone = buildClone(source, { id: 'n', name: 'n', now: NOW, cloudActor: 'uid-me' });
    expect(clone._changeLog).toEqual([{ action: 'cloned', timestamp: NOW, actor: 'uid-me', detail: 'src00001' }]);
  });
});

describe('cloneName (R15)', () => {
  it('"X (copy)", then "X (copy 2)" when "x (copy)" is taken in any case or spacing', () => {
    expect(cloneName('Alpha', ['Alpha'])).toBe('Alpha (copy)');
    expect(cloneName('Alpha', ['Alpha', ' alpha (COPY) '])).toBe('Alpha (copy 2)');
  });

  it('an unnamed (cloud) source clones as "Untitled project (copy)"', () => {
    expect(cloneName('', [''])).toBe('Untitled project (copy)');
  });

  it('a 200-character source stays within the limit', () => {
    const name = cloneName('L'.repeat(MAX_NAME_LENGTH), []);
    expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    expect(name.endsWith(' (copy)')).toBe(true);
  });
});

describe('cloneSource (O20)', () => {
  it('the loaded copy when it IS the project', async () => {
    const loadProject = vi.fn();
    expect(await cloneSource(source, 'src00001', { loadProject })).toBe(source);
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('the stored copy when the loaded copy is another project (a switch pending), or none is loaded', async () => {
    const stored = { ...source, name: 'Stored' };
    const loadProject = vi.fn(async () => stored);
    expect(await cloneSource({ ...source, id: 'other' }, 'src00001', { loadProject })).toBe(stored);
    expect(await cloneSource(null, 'src00001', { loadProject })).toBe(stored);
  });

  it('null when the stored copy cannot be read', async () => {
    expect(await cloneSource(null, 'x', { loadProject: async () => { throw new Error('denied'); } })).toBeNull();
  });
});
