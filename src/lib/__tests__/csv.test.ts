import { describe, it, expect } from 'vitest';
import {
  snapshotsToCSV,
  parseCSV,
  suggestMapping,
  applyCSVImport,
} from '../csv';
import type { Snapshot, WorkflowState } from '@/types';

const workflow: WorkflowState[] = [
  { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
  { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
  { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
];

const snapshots: Snapshot[] = [
  { date: '2024-01-01', counts: { backlog: 10, dev: 0, done: 0 } },
  { date: '2024-01-02', counts: { backlog: 8, dev: 2, done: 0 } },
  { date: '2024-01-03', counts: { backlog: 5, dev: 3, done: 2 } },
];

describe('snapshotsToCSV', () => {
  it('exports with correct headers', () => {
    const csv = snapshotsToCSV(snapshots, workflow, false);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,Backlog,In Dev,Done');
  });

  it('exports data rows in chronological order', () => {
    const csv = snapshotsToCSV(snapshots, workflow, false);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('2024-01-01,10,0,0');
    expect(lines[2]).toBe('2024-01-02,8,2,0');
    expect(lines[3]).toBe('2024-01-03,5,3,2');
  });

  it('exports newest-first when requested', () => {
    const csv = snapshotsToCSV(snapshots, workflow, true);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('2024-01-03');
    expect(lines[3]).toContain('2024-01-01');
  });

  it('handles missing counts as 0', () => {
    const sparse: Snapshot[] = [
      { date: '2024-01-01', counts: { backlog: 5 } },
    ];
    const csv = snapshotsToCSV(sparse, workflow, false);
    expect(csv.split('\n')[1]).toBe('2024-01-01,5,0,0');
  });
});

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const result = parseCSV('A,B,C\n1,2,3\n4,5,6');
    expect(result.headers).toEqual(['A', 'B', 'C']);
    expect(result.rows).toEqual([['1', '2', '3'], ['4', '5', '6']]);
  });

  it('handles quoted fields with commas', () => {
    const result = parseCSV('Name,Value\n"Hello, World",42');
    expect(result.rows[0][0]).toBe('Hello, World');
    expect(result.rows[0][1]).toBe('42');
  });

  it('handles escaped quotes in quoted fields', () => {
    const result = parseCSV('Name\n"Say ""hello"""\n');
    expect(result.rows[0][0]).toBe('Say "hello"');
  });

  it('handles empty input', () => {
    const result = parseCSV('');
    expect(result.headers).toEqual(['']);
    expect(result.rows).toEqual([]);
  });

  it('handles Windows line endings', () => {
    const result = parseCSV('A,B\r\n1,2\r\n3,4');
    expect(result.rows).toHaveLength(2);
  });
});

describe('suggestMapping', () => {
  it('maps Date column automatically', () => {
    const mapping = suggestMapping(['Date', 'Backlog', 'Other'], workflow);
    expect(mapping[0]).toBe('date');
  });

  it('maps matching workflow state names', () => {
    const mapping = suggestMapping(['Date', 'Backlog', 'In Dev', 'Done'], workflow);
    expect(mapping[1]).toBe('backlog');
    expect(mapping[2]).toBe('dev');
    expect(mapping[3]).toBe('done');
  });

  it('marks unrecognized columns as skip', () => {
    const mapping = suggestMapping(['Date', 'Priority', 'Notes'], workflow);
    expect(mapping[1]).toBe('skip');
    expect(mapping[2]).toBe('skip');
  });

  it('is case-insensitive for matching', () => {
    const mapping = suggestMapping(['date', 'BACKLOG', 'in dev'], workflow);
    expect(mapping[0]).toBe('date');
    expect(mapping[1]).toBe('backlog');
    expect(mapping[2]).toBe('dev');
  });
});

describe('applyCSVImport', () => {
  it('imports rows with correct mapping', () => {
    const parsed = parseCSV('Date,Backlog,In Dev,Done\n2024-02-01,5,3,2');
    const mapping = suggestMapping(parsed.headers, workflow);
    const stateIds = workflow.map((s) => s.id);

    const result = applyCSVImport(parsed, mapping, [], stateIds);
    expect(result.importedCount).toBe(1);
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].counts.backlog).toBe(5);
    expect(result.snapshots[0].counts.dev).toBe(3);
  });

  it('merges with existing snapshots', () => {
    const parsed = parseCSV('Date,Backlog,In Dev,Done\n2024-01-04,3,4,3');
    const mapping = suggestMapping(parsed.headers, workflow);
    const stateIds = workflow.map((s) => s.id);

    const result = applyCSVImport(parsed, mapping, snapshots, stateIds);
    expect(result.snapshots).toHaveLength(4);
    expect(result.overwrittenCount).toBe(0);
  });

  it('overwrites existing dates', () => {
    const parsed = parseCSV('Date,Backlog,In Dev,Done\n2024-01-01,99,0,0');
    const mapping = suggestMapping(parsed.headers, workflow);
    const stateIds = workflow.map((s) => s.id);

    const result = applyCSVImport(parsed, mapping, snapshots, stateIds);
    expect(result.overwrittenCount).toBe(1);
    const overwritten = result.snapshots.find((s) => s.date === '2024-01-01');
    expect(overwritten?.counts.backlog).toBe(99);
  });

  it('skips rows with invalid dates', () => {
    const parsed = parseCSV('Date,Backlog\nbaddate,5\n2024-01-05,3');
    const mapping = suggestMapping(parsed.headers, workflow);
    const stateIds = workflow.map((s) => s.id);

    const result = applyCSVImport(parsed, mapping, [], stateIds);
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('handles no date column mapped', () => {
    const parsed = parseCSV('Backlog,Done\n5,3');
    const mapping = suggestMapping(parsed.headers, workflow);
    const stateIds = workflow.map((s) => s.id);

    const result = applyCSVImport(parsed, mapping, snapshots, stateIds);
    expect(result.importedCount).toBe(0);
    expect(result.snapshots).toEqual(snapshots);
  });

  it('round-trips through export/import without data loss', () => {
    const csv = snapshotsToCSV(snapshots, workflow, false);
    const parsed = parseCSV(csv);
    const mapping = suggestMapping(parsed.headers, workflow);
    const stateIds = workflow.map((s) => s.id);

    const result = applyCSVImport(parsed, mapping, [], stateIds);
    expect(result.snapshots).toHaveLength(snapshots.length);

    for (const original of snapshots) {
      const imported = result.snapshots.find((s) => s.date === original.date);
      expect(imported).toBeDefined();
      expect(imported!.counts).toEqual(original.counts);
    }
  });
});
