// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import type { Project } from '@/types';
import type { ProjectListItem } from '@/lib/storage-driver';
import {
  normalizeProjectName,
  classifyImportData,
  detectImportConflicts,
  conflictsEqual,
  applyImportDecisions,
  buildNewProjectList,
  computeImportMerge,
  computeWriteRollback,
  shouldAutoSwitch,
  shouldIncrementProjectKey,
  buildBannerText,
  processImportData,
  type ImportConflict,
  type ImportDecisions,
  type ApplyImportResult,
  type ImportMergeOutcome,
} from '../import-utils';

// ── Test helpers ─────────────────────────────────────────

/** Builds a minimal valid Project with deterministic id + name. */
function makeProject(id: string, name: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 },
    ],
    snapshots: [],
    settings: {
      gridSortNewestFirst: true,
      showWipWarnings: true,
      metricsPeriod: { kind: 'all' },
    },
    ...overrides,
  };
}

/** Serializes a Project to its JSON-export shape (drops Date conversion etc). */
function projectJson(p: Project): Record<string, unknown> {
  return JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
}

// ── normalizeProjectName ─────────────────────────────────

describe('normalizeProjectName', () => {
  it('trims and lowercases', () => {
    expect(normalizeProjectName('  Foo Bar  ')).toBe('foo bar');
  });

  it('handles already-normalized input idempotently', () => {
    expect(normalizeProjectName('foo')).toBe('foo');
    expect(normalizeProjectName('')).toBe('');
  });
});

// ── classifyImportData ────────────────────────────────────

describe('classifyImportData', () => {
  it('rejects invalid JSON', () => {
    const result = classifyImportData('{not json');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/invalid json/i);
    }
  });

  it('rejects an empty array', () => {
    const result = classifyImportData('[]');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/empty/i);
    }
  });

  it('accepts a valid single project object', () => {
    const p = makeProject('id1', 'Foo');
    const result = classifyImportData(JSON.stringify(p));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].id).toBe('id1');
      expect(result.projects[0].name).toBe('Foo');
    }
  });

  it('accepts a valid array of projects', () => {
    const p1 = makeProject('a', 'A');
    const p2 = makeProject('b', 'B');
    const result = classifyImportData(JSON.stringify([p1, p2]));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.projects).toHaveLength(2);
      expect(result.projects.map((p) => p.id)).toEqual(['a', 'b']);
    }
  });

  it('rejects array with one invalid element and labels by name', () => {
    const valid = makeProject('a', 'Good');
    const invalid = { ...projectJson(makeProject('b', 'Bad')), workflow: [] };
    const result = classifyImportData(JSON.stringify([valid, invalid]));
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toContain('"Bad"');
    }
  });

  it('rejects invalid element without name, labels by index', () => {
    const valid = makeProject('a', 'Good');
    const invalid = { ...projectJson(makeProject('b', 'X')), name: undefined };
    const result = classifyImportData(JSON.stringify([valid, invalid]));
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/#2/);
    }
  });

  it('rejects unrecognized JSON primitives', () => {
    expect(classifyImportData('42').kind).toBe('invalid');
    expect(classifyImportData('"string"').kind).toBe('invalid');
  });

  it('rejects JSON null', () => {
    expect(classifyImportData('null').kind).toBe('invalid');
  });

  it('runs migration path for old _version (current PROJECT_MIGRATIONS empty — exercises plumbing)', () => {
    const p = { ...projectJson(makeProject('a', 'OldVer')), _version: '0.0.1' };
    const result = classifyImportData(JSON.stringify(p));
    expect(result.kind).toBe('ok');
  });

  it('shapeIncomingProject drops unknown fields and sets fresh updatedAt', () => {
    const before = new Date().toISOString();
    const raw = { ...projectJson(makeProject('a', 'A')), evilField: 'should-be-dropped' };
    const result = classifyImportData(JSON.stringify(raw));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect((result.projects[0] as unknown as Record<string, unknown>).evilField).toBeUndefined();
      expect(result.projects[0].updatedAt >= before).toBe(true);
    }
  });

  it('preserves explicit id when present in input', () => {
    const p = makeProject('preserved-id', 'P');
    const result = classifyImportData(JSON.stringify(p));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.projects[0].id).toBe('preserved-id');
    }
  });

  it('HR6-1: generates fresh nanoid id when id field is missing', () => {
    const raw = { ...projectJson(makeProject('temp', 'NoId')), id: undefined };
    const result = classifyImportData(JSON.stringify(raw));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(typeof result.projects[0].id).toBe('string');
      // nanoid(8) → 8-char base64url alphabet
      expect(result.projects[0].id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    }
  });
});

// ── detectImportConflicts ─────────────────────────────────

describe('detectImportConflicts', () => {
  it('returns empty when ids and names differ', () => {
    const incoming = [makeProject('a', 'A')];
    const current: ProjectListItem[] = [{ id: 'b', name: 'B' }];
    expect(detectImportConflicts(incoming, current)).toEqual([]);
  });

  it('detects id conflict', () => {
    const inc = makeProject('shared', 'Different Name');
    const cur: ProjectListItem[] = [{ id: 'shared', name: 'Other' }];
    const conflicts = detectImportConflicts([inc], cur);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('id');
  });

  it('detects name conflict (case-insensitive)', () => {
    const inc = makeProject('inc-1', 'Foo');
    const cur: ProjectListItem[] = [{ id: 'cur-1', name: 'foo' }];
    const conflicts = detectImportConflicts([inc], cur);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('name');
  });

  it('detects name conflict (whitespace tolerant)', () => {
    const inc = makeProject('inc-1', '  Foo  ');
    const cur: ProjectListItem[] = [{ id: 'cur-1', name: 'Foo' }];
    const conflicts = detectImportConflicts([inc], cur);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('name');
  });

  it('prioritizes id match over name match', () => {
    const inc = makeProject('shared-id', 'Bar');
    const cur: ProjectListItem[] = [
      { id: 'shared-id', name: 'Different' },
      { id: 'other', name: 'Bar' },
    ];
    const conflicts = detectImportConflicts([inc], cur);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('id');
    expect(conflicts[0].existing.id).toBe('shared-id');
  });

  it('handles a mix of conflict types across multiple incoming projects', () => {
    const incoming = [
      makeProject('a', 'A'), // no conflict
      makeProject('b', 'B-Match'), // name conflict
      makeProject('c', 'C'), // id conflict
    ];
    const current: ProjectListItem[] = [
      { id: 'cur-b', name: 'b-match' },
      { id: 'c', name: 'something' },
    ];
    const conflicts = detectImportConflicts(incoming, current);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].type).toBe('name');
    expect(conflicts[1].type).toBe('id');
  });

  it('returns empty for empty incoming', () => {
    expect(detectImportConflicts([], [{ id: 'x', name: 'X' }])).toEqual([]);
  });

  it('returns empty for empty current list', () => {
    expect(detectImportConflicts([makeProject('a', 'A')], [])).toEqual([]);
  });
});

// ── conflictsEqual ────────────────────────────────────────

describe('conflictsEqual', () => {
  const incA = makeProject('a', 'A');
  const incB = makeProject('b', 'B');
  const exA: ProjectListItem = { id: 'ex-a', name: 'exA' };
  const exB: ProjectListItem = { id: 'ex-b', name: 'exB' };

  it('returns true for identical arrays', () => {
    const a: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'id' }];
    const b: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'id' }];
    expect(conflictsEqual(a, b)).toBe(true);
  });

  it('returns false for different lengths', () => {
    const a: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'id' }];
    const b: ImportConflict[] = [];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('returns false for different incoming.id', () => {
    const a: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'id' }];
    const b: ImportConflict[] = [{ incoming: incB, existing: exA, type: 'id' }];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('returns false for different existing.id', () => {
    const a: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'id' }];
    const b: ImportConflict[] = [{ incoming: incA, existing: exB, type: 'id' }];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('returns false for different conflict type', () => {
    const a: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'id' }];
    const b: ImportConflict[] = [{ incoming: incA, existing: exA, type: 'name' }];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('is order-sensitive', () => {
    const ca: ImportConflict = { incoming: incA, existing: exA, type: 'id' };
    const cb: ImportConflict = { incoming: incB, existing: exB, type: 'name' };
    expect(conflictsEqual([ca, cb], [cb, ca])).toBe(false);
  });
});

// ── applyImportDecisions ──────────────────────────────────

describe('applyImportDecisions', () => {
  it('adds all when there are no conflicts', () => {
    const incoming = [makeProject('a', 'A'), makeProject('b', 'B')];
    const result = applyImportDecisions(incoming, new Map(), []);
    expect(result.added).toHaveLength(2);
    expect(result.replaced).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips all when every conflict resolves to skip', () => {
    const inc = makeProject('a', 'A');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'cur', name: 'A' }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([['a', 'skip']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.added).toHaveLength(0);
    expect(result.skipped).toEqual(['a']);
  });

  it('replaces in-place for id conflicts', () => {
    const inc = makeProject('shared', 'Updated');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'shared', name: 'Original' }, type: 'id' },
    ];
    const decisions: ImportDecisions = new Map([['shared', 'replace']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.replaced).toHaveLength(1);
    expect(result.replaced[0].id).toBe('shared');
    expect(result.replaced[0].name).toBe('Updated');
  });

  it('swaps id to existing slot for name-conflict replace', () => {
    const inc = makeProject('incoming-id', 'Foo');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'existing-id', name: 'foo' }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([['incoming-id', 'replace']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.replaced[0].id).toBe('existing-id');
    expect(result.replaced[0].name).toBe('Foo');
  });

  it('suffixes name on copy for name-conflict', () => {
    const inc = makeProject('inc', 'Foo');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'cur', name: 'Foo' }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([['inc', 'copy']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].name).toBe('Foo (copy)');
    expect(result.added[0].id).toBe('inc'); // preserved (no id conflict)
  });

  it('generates fresh id on copy for id-conflict', () => {
    const inc = makeProject('shared', 'Other');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'shared', name: 'Different' }, type: 'id' },
    ];
    const decisions: ImportDecisions = new Map([['shared', 'copy']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).not.toBe('shared');
    expect(result.added[0].id).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it('handles mixed decisions across multiple incoming', () => {
    const inc1 = makeProject('a', 'A'); // no conflict → add
    const inc2 = makeProject('b', 'B'); // name conflict → skip
    const inc3 = makeProject('c', 'C'); // id conflict → replace
    const inc4 = makeProject('d', 'D'); // name conflict → copy
    const conflicts: ImportConflict[] = [
      { incoming: inc2, existing: { id: 'cur-b', name: 'B' }, type: 'name' },
      { incoming: inc3, existing: { id: 'c', name: 'old-c' }, type: 'id' },
      { incoming: inc4, existing: { id: 'cur-d', name: 'D' }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([
      ['b', 'skip'],
      ['c', 'replace'],
      ['d', 'copy'],
    ]);
    const result = applyImportDecisions([inc1, inc2, inc3, inc4], decisions, conflicts);
    expect(result.added.map((p) => p.id)).toEqual(['a', 'd']);
    expect(result.replaced.map((p) => p.id)).toEqual(['c']);
    expect(result.skipped).toEqual(['b']);
  });

  it('deduplicates two same-name copies via numeric suffix', () => {
    const inc1 = makeProject('a', 'Foo');
    const inc2 = makeProject('b', 'Foo');
    const conflicts: ImportConflict[] = [
      { incoming: inc1, existing: { id: 'cur', name: 'Foo' }, type: 'name' },
      { incoming: inc2, existing: { id: 'cur', name: 'Foo' }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([
      ['a', 'copy'],
      ['b', 'copy'],
    ]);
    const result = applyImportDecisions([inc1, inc2], decisions, conflicts);
    const names = result.added.map((p) => p.name);
    expect(names).toContain('Foo (copy)');
    expect(names).toContain('Foo (copy 2)');
  });

  it('truncates base name when (copy) suffix would exceed MAX_NAME_LENGTH', () => {
    const longName = 'X'.repeat(200);
    const inc = makeProject('a', longName);
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'cur', name: longName }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([['a', 'copy']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.added[0].name.length).toBeLessThanOrEqual(200);
    expect(result.added[0].name).toMatch(/\(copy\)$/);
  });

  it('defaults missing decision to skip', () => {
    const inc = makeProject('a', 'A');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'cur', name: 'A' }, type: 'name' },
    ];
    const result = applyImportDecisions([inc], new Map(), conflicts);
    expect(result.skipped).toEqual(['a']);
    expect(result.added).toHaveLength(0);
  });

  it('preserves incoming order in added array', () => {
    const incoming = [makeProject('c', 'C'), makeProject('a', 'A'), makeProject('b', 'B')];
    const result = applyImportDecisions(incoming, new Map(), []);
    expect(result.added.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('name-conflict replace produces a Project at the existing.id slot', () => {
    const inc = makeProject('new', 'Match', { snapshots: [{ date: '2026-01-01', counts: { backlog: 5 } }] });
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'old', name: 'match' }, type: 'name' },
    ];
    const decisions: ImportDecisions = new Map([['new', 'replace']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.replaced[0].id).toBe('old');
    expect(result.replaced[0].snapshots).toHaveLength(1); // data preserved
  });

  it('id-conflict copy keeps original name when name does not collide', () => {
    const inc = makeProject('shared', 'Unique-Name');
    const conflicts: ImportConflict[] = [
      { incoming: inc, existing: { id: 'shared', name: 'Different' }, type: 'id' },
    ];
    const decisions: ImportDecisions = new Map([['shared', 'copy']]);
    const result = applyImportDecisions([inc], decisions, conflicts);
    expect(result.added[0].name).toBe('Unique-Name');
  });

  it('returns empty result for empty incoming', () => {
    const result = applyImportDecisions([], new Map(), []);
    expect(result.added).toEqual([]);
    expect(result.replaced).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

// ── buildNewProjectList ───────────────────────────────────

describe('buildNewProjectList', () => {
  it('returns prev unchanged on all-skip', () => {
    const prev: ProjectListItem[] = [{ id: 'a', name: 'A' }];
    const result: ApplyImportResult = { added: [], replaced: [], skipped: ['x'] };
    expect(buildNewProjectList(prev, result)).toBe(prev);
  });

  it('appends a non-conflicting add', () => {
    const prev: ProjectListItem[] = [{ id: 'a', name: 'A' }];
    const result: ApplyImportResult = { added: [makeProject('b', 'B')], replaced: [], skipped: [] };
    expect(buildNewProjectList(prev, result)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
  });

  it('updates name on replace', () => {
    const prev: ProjectListItem[] = [{ id: 'a', name: 'OldName' }];
    const result: ApplyImportResult = {
      added: [],
      replaced: [makeProject('a', 'NewName')],
      skipped: [],
    };
    expect(buildNewProjectList(prev, result)).toEqual([{ id: 'a', name: 'NewName' }]);
  });

  it('preserves owner field on replace', () => {
    const prev: ProjectListItem[] = [{ id: 'a', name: 'OldName', owner: 'uid-1' }];
    const result: ApplyImportResult = {
      added: [],
      replaced: [makeProject('a', 'NewName')],
      skipped: [],
    };
    expect(buildNewProjectList(prev, result)).toEqual([
      { id: 'a', name: 'NewName', owner: 'uid-1' },
    ]);
  });

  it('drops a replace whose target was concurrently deleted', () => {
    const prev: ProjectListItem[] = [{ id: 'kept', name: 'Kept' }];
    const result: ApplyImportResult = {
      added: [],
      replaced: [makeProject('gone', 'WouldReplace')],
      skipped: [],
    };
    expect(buildNewProjectList(prev, result)).toEqual([{ id: 'kept', name: 'Kept' }]);
  });

  it('does not duplicate an add whose id is already in prev', () => {
    const prev: ProjectListItem[] = [{ id: 'a', name: 'A' }];
    const result: ApplyImportResult = {
      added: [makeProject('a', 'A-redundant')],
      replaced: [],
      skipped: [],
    };
    expect(buildNewProjectList(prev, result)).toEqual([{ id: 'a', name: 'A' }]);
  });

  it('preserves existing order with adds appended', () => {
    const prev: ProjectListItem[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const result: ApplyImportResult = {
      added: [makeProject('c', 'C'), makeProject('d', 'D')],
      replaced: [],
      skipped: [],
    };
    expect(buildNewProjectList(prev, result).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

// ── computeImportMerge ────────────────────────────────────

describe('computeImportMerge', () => {
  it('returns ok with apply result when conflicts have not drifted', () => {
    const inc = makeProject('a', 'A');
    const current: ProjectListItem[] = [];
    const result = computeImportMerge({
      incoming: [inc],
      decisions: new Map(),
      originalConflicts: [],
      currentProjects: current,
    });
    expect(result.ok).toBe(true);
  });

  it('returns drift when project list changed (concurrent delete vacated a conflict)', () => {
    const inc = makeProject('a', 'A');
    const original: ImportConflict[] = [
      { incoming: inc, existing: { id: 'cur', name: 'A' }, type: 'name' },
    ];
    const result = computeImportMerge({
      incoming: [inc],
      decisions: new Map([['a', 'replace']]),
      originalConflicts: original,
      currentProjects: [], // concurrent delete cleared the conflict
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe('drift');
  });

  it('returns drift when a new conflict appeared (concurrent rename)', () => {
    const inc = makeProject('a', 'A');
    const result = computeImportMerge({
      incoming: [inc],
      decisions: new Map(),
      originalConflicts: [], // no conflicts at preview-open time
      currentProjects: [{ id: 'cur', name: 'A' }], // concurrent rename created a name conflict
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe('drift');
  });

  it('returns drift when conflict type changed (id vs name)', () => {
    const inc = makeProject('a', 'A');
    const originalAsName: ImportConflict[] = [
      { incoming: inc, existing: { id: 'cur', name: 'A' }, type: 'name' },
    ];
    const result = computeImportMerge({
      incoming: [inc],
      decisions: new Map([['a', 'skip']]),
      originalConflicts: originalAsName,
      currentProjects: [{ id: 'a', name: 'Renamed' }], // now id-conflict instead of name
    });
    expect(result.ok).toBe(false);
  });

  it('result is deep-equal to an independent applyImportDecisions invocation', () => {
    const inc1 = makeProject('a', 'A'); // no conflict
    const inc2 = makeProject('b', 'B-Match'); // name conflict
    const inc3 = makeProject('c', 'C'); // id conflict
    const incoming = [inc1, inc2, inc3];
    const current: ProjectListItem[] = [
      { id: 'cur-b', name: 'B-Match' },
      { id: 'c', name: 'old-c' },
    ];
    const conflicts = detectImportConflicts(incoming, current);
    const decisions: ImportDecisions = new Map([
      ['b', 'copy'],
      ['c', 'replace'],
    ]);
    const merge = computeImportMerge({
      incoming,
      decisions,
      originalConflicts: conflicts,
      currentProjects: current,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.result).toEqual(applyImportDecisions(incoming, decisions, conflicts));
  });

  it('handles empty incoming with empty result', () => {
    const result = computeImportMerge({
      incoming: [],
      decisions: new Map(),
      originalConflicts: [],
      currentProjects: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.added).toEqual([]);
      expect(result.result.replaced).toEqual([]);
      expect(result.result.skipped).toEqual([]);
    }
  });
});

// ── computeWriteRollback ──────────────────────────────────

describe('computeWriteRollback', () => {
  it('reports addedOk = N when all fulfilled', () => {
    const added = [makeProject('a', 'A'), makeProject('b', 'B')];
    const results: PromiseSettledResult<void>[] = [
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ];
    const plan = computeWriteRollback(results, added);
    expect(plan.addedOk).toBe(2);
    expect(plan.writeFailedCount).toBe(0);
    expect(plan.failedAddedIds.size).toBe(0);
  });

  it('reports all rejected with all ids in failedAddedIds', () => {
    const added = [makeProject('a', 'A'), makeProject('b', 'B')];
    const results: PromiseSettledResult<void>[] = [
      { status: 'rejected', reason: new Error('x') },
      { status: 'rejected', reason: new Error('y') },
    ];
    const plan = computeWriteRollback(results, added);
    expect(plan.addedOk).toBe(0);
    expect(plan.writeFailedCount).toBe(2);
    expect(plan.failedAddedIds).toEqual(new Set(['a', 'b']));
  });

  it('reports partial failures correctly', () => {
    const added = [makeProject('a', 'A'), makeProject('b', 'B'), makeProject('c', 'C')];
    const results: PromiseSettledResult<void>[] = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('boom') },
      { status: 'fulfilled', value: undefined },
    ];
    const plan = computeWriteRollback(results, added);
    expect(plan.addedOk).toBe(2);
    expect(plan.writeFailedCount).toBe(1);
    expect(plan.failedAddedIds).toEqual(new Set(['b']));
  });

  it('handles empty results array', () => {
    const plan = computeWriteRollback([], []);
    expect(plan.addedOk).toBe(0);
    expect(plan.writeFailedCount).toBe(0);
    expect(plan.failedAddedIds.size).toBe(0);
  });

  it('pairs results with added by index', () => {
    const added = [makeProject('first', 'First'), makeProject('second', 'Second')];
    const results: PromiseSettledResult<void>[] = [
      { status: 'rejected', reason: new Error('only-first') },
      { status: 'fulfilled', value: undefined },
    ];
    const plan = computeWriteRollback(results, added);
    expect(plan.failedAddedIds.has('first')).toBe(true);
    expect(plan.failedAddedIds.has('second')).toBe(false);
  });
});

// ── buildBannerText ───────────────────────────────────────

describe('buildBannerText', () => {
  const outcome = (over: Partial<ImportMergeOutcome>): ImportMergeOutcome => ({
    ok: true,
    added: 0,
    replaced: 0,
    skipped: 0,
    ...over,
  });

  it('formats a single add', () => {
    expect(buildBannerText(outcome({ added: 1 }))).toBe('Added 1 project.');
  });

  it('pluralizes multiple adds', () => {
    expect(buildBannerText(outcome({ added: 3 }))).toBe('Added 3 projects.');
  });

  it('formats a single replace', () => {
    expect(buildBannerText(outcome({ replaced: 1 }))).toBe('Replaced 1 project.');
  });

  it('formats a single skip', () => {
    expect(buildBannerText(outcome({ skipped: 1 }))).toBe('Skipped 1 project.');
  });

  it('joins all three parts with commas', () => {
    expect(buildBannerText(outcome({ added: 1, replaced: 2, skipped: 1 }))).toBe(
      'Added 1 project, Replaced 2 projects, Skipped 1 project.',
    );
  });

  it('appends addFailedCount suffix when present', () => {
    expect(buildBannerText(outcome({ added: 2, addFailedCount: 1 }))).toBe(
      'Added 2 projects. 1 project failed to import.',
    );
  });

  it('pluralizes addFailedCount', () => {
    expect(buildBannerText(outcome({ added: 5, addFailedCount: 3 }))).toBe(
      'Added 5 projects. 3 projects failed to import.',
    );
  });

  it('returns no-changes message when all parts are zero', () => {
    expect(buildBannerText(outcome({}))).toBe('No changes were made.');
  });

  it('shows only the failure sentence when there are no positive parts but failures exist', () => {
    expect(buildBannerText(outcome({ addFailedCount: 2 }))).toBe(
      '2 projects failed to import.',
    );
  });

  it('does not append addFailedCount sentence when count is 0', () => {
    expect(buildBannerText(outcome({ added: 1, addFailedCount: 0 }))).toBe(
      'Added 1 project.',
    );
  });

  it('formats only adds for single-count input', () => {
    expect(buildBannerText(outcome({ added: 1 }))).toBe('Added 1 project.');
  });

  it('formats only replaces for multi-count input', () => {
    expect(buildBannerText(outcome({ replaced: 4 }))).toBe('Replaced 4 projects.');
  });

  it('HR6-3: replaces succeeded but adds all failed → green banner with failure suffix', () => {
    expect(
      buildBannerText(outcome({ added: 0, replaced: 2, skipped: 0, addFailedCount: 1 })),
    ).toBe('Replaced 2 projects. 1 project failed to import.');
  });
});

// ── processImportData ────────────────────────────────────

describe('processImportData', () => {
  it('returns ok with a single valid project and no conflicts', () => {
    const p = makeProject('a', 'A');
    const result = processImportData(JSON.stringify(p), []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.incoming).toHaveLength(1);
      expect(result.conflicts).toHaveLength(0);
    }
  });

  it('returns ok with multi-project array', () => {
    const arr = [makeProject('a', 'A'), makeProject('b', 'B')];
    const result = processImportData(JSON.stringify(arr), []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.incoming).toHaveLength(2);
    }
  });

  it('returns invalid for malformed JSON', () => {
    const result = processImportData('{not-json', []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/invalid json/i);
  });

  it('detects conflicts against current list', () => {
    const p = makeProject('a', 'Foo');
    const current: ProjectListItem[] = [{ id: 'cur', name: 'Foo' }];
    const result = processImportData(JSON.stringify(p), current);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('name');
    }
  });

  it('returns empty conflicts when names and ids are unique', () => {
    const p = makeProject('a', 'A');
    const current: ProjectListItem[] = [{ id: 'b', name: 'B' }];
    const result = processImportData(JSON.stringify(p), current);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conflicts).toEqual([]);
    }
  });
});

// ── shouldAutoSwitch ──────────────────────────────────────

describe('shouldAutoSwitch', () => {
  const okResult = (added: Project[], replaced: Project[] = []): ApplyImportResult => ({
    added,
    replaced,
    skipped: [],
  });

  it('returns true for single import with one successful add', () => {
    expect(shouldAutoSwitch(1, okResult([makeProject('a', 'A')]), new Set())).toBe(true);
  });

  it('returns false for multi-project import', () => {
    expect(
      shouldAutoSwitch(2, okResult([makeProject('a', 'A'), makeProject('b', 'B')]), new Set()),
    ).toBe(false);
  });

  it('returns false when the add failed', () => {
    expect(
      shouldAutoSwitch(1, okResult([makeProject('a', 'A')]), new Set(['a'])),
    ).toBe(false);
  });

  it('returns false when the outcome is a replace (no add)', () => {
    expect(
      shouldAutoSwitch(1, okResult([], [makeProject('a', 'A')]), new Set()),
    ).toBe(false);
  });
});

// ── shouldIncrementProjectKey ─────────────────────────────

describe('shouldIncrementProjectKey', () => {
  it('returns true in local mode when activeProjectId is replaced', () => {
    expect(shouldIncrementProjectKey('local', 'a', [makeProject('a', 'A')])).toBe(true);
  });

  it('returns false in cloud mode even when activeProjectId is replaced', () => {
    expect(shouldIncrementProjectKey('cloud', 'a', [makeProject('a', 'A')])).toBe(false);
  });

  it('returns false in local mode when activeProjectId is not in replaced', () => {
    expect(shouldIncrementProjectKey('local', 'a', [makeProject('b', 'B')])).toBe(false);
  });

  it('returns false when activeProjectId is null', () => {
    expect(shouldIncrementProjectKey('local', null, [makeProject('a', 'A')])).toBe(false);
  });
});

