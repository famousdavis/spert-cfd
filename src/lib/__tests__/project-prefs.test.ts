// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.21.0 (DASH26 R2): the person's tile colour and archive map, pure.
import { describe, it, expect } from 'vitest';
import {
  MAX_PROJECT_PREFS,
  isRefusedPrefId,
  isProjectArchived,
  overCap,
  projectPrefOf,
  sanitizeProjectPrefs,
  shownProjects,
  withPrefField,
} from '../project-prefs';

describe('isRefusedPrefId (O60: one rule for read, write and the controls)', () => {
  it('refuses empty, __x__, non-strings and every Object.prototype member name', () => {
    for (const id of ['', '__proto__', '__x__', 'constructor', 'hasOwnProperty', 'toString', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__']) {
      expect(isRefusedPrefId(id), id).toBe(true);
    }
    expect(isRefusedPrefId(3)).toBe(true);
    expect(isRefusedPrefId(undefined)).toBe(true);
  });

  it('accepts ordinary ids, a dotted one and one that only looks like a member', () => {
    for (const id of ['abc12345', 'x.y', '_proto_', 'Constructor', 'hasOwnProperty2', '__x']) expect(isRefusedPrefId(id), id).toBe(false);
  });
});

describe('sanitizeProjectPrefs', () => {
  it('keeps each field on its own: a refused colour leaves a valid archive; archived is true or absent', () => {
    expect(
      sanitizeProjectPrefs({
        a: { color: 'blue', archived: true },
        b: { color: 'red', archived: true },
        c: { color: 'teal', archived: 'true' },
        d: { color: 'Blue' },
        e: {},
        f: null,
        g: [1],
        h: { archived: false, extra: 1 },
      }),
    ).toEqual({ a: { color: 'blue', archived: true }, b: { archived: true }, c: { color: 'teal' } });
  });

  it('drops every refused id, reads a non-map as {}, and never throws', () => {
    const raw = JSON.parse('{"__proto__":{"archived":true},"hasOwnProperty":{"archived":true},"toString":{"color":"pink"},"ok":{"color":"slate"}}');
    expect(sanitizeProjectPrefs(raw)).toEqual({ ok: { color: 'slate' } });
    for (const v of [null, undefined, 'x', 3, [], [{ color: 'blue' }]]) expect(sanitizeProjectPrefs(v)).toEqual({});
  });

  it('keeps at most 1,000 entries, and refused or empty entries use no place', () => {
    const raw: Record<string, unknown> = { '': { archived: true }, empty: {} };
    for (let i = 0; i < MAX_PROJECT_PREFS + 5; i++) raw[`p${i}`] = { archived: true };
    const out = sanitizeProjectPrefs(raw);
    expect(Object.keys(out)).toHaveLength(MAX_PROJECT_PREFS);
    expect(out.p0).toEqual({ archived: true });
    expect(out[`p${MAX_PROJECT_PREFS - 1}`]).toEqual({ archived: true });
    expect(out[`p${MAX_PROJECT_PREFS}`]).toBeUndefined();
  });
});

describe('reading an entry', () => {
  it('projectPrefOf reads own properties only', () => {
    expect(projectPrefOf({}, 'toString')).toEqual({});
    expect(projectPrefOf({ a: { color: 'pink' } }, 'a')).toEqual({ color: 'pink' });
    expect(projectPrefOf(undefined, 'a')).toEqual({});
    expect(isProjectArchived({ a: { archived: true } }, 'a')).toBe(true);
    expect(isProjectArchived({ a: { color: 'blue' } }, 'a')).toBe(false);
  });

  it('shownProjects hides archived ones without reordering, or shows all', () => {
    const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const prefs = { b: { archived: true as const } };
    expect(shownProjects(projects, prefs, false).map((p) => p.id)).toEqual(['a', 'c']);
    expect(shownProjects(projects, prefs, true).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('withPrefField', () => {
  it('changes one field and keeps the other; colouring an archived entry keeps it archived (GanttApp G1)', () => {
    const start = { a: { archived: true as const }, b: { color: 'blue' as const } };
    expect(withPrefField(start, 'a', 'color', 'teal')).toEqual({ a: { archived: true, color: 'teal' }, b: { color: 'blue' } });
    expect(withPrefField(start, 'b', 'archived', true)).toEqual({ a: { archived: true }, b: { color: 'blue', archived: true } });
    expect(start).toEqual({ a: { archived: true }, b: { color: 'blue' } }); // untouched
  });

  it('removes an emptied entry', () => {
    expect(withPrefField({ a: { color: 'pink' } }, 'a', 'color', undefined)).toEqual({});
    expect(withPrefField({ a: { archived: true } }, 'a', 'archived', undefined)).toEqual({});
  });

  it('overCap: only a NEW entry past 1,000 is over', () => {
    const full: Record<string, { archived: true }> = {};
    for (let i = 0; i < MAX_PROJECT_PREFS; i++) full[`p${i}`] = { archived: true };
    expect(overCap(full, 'new', true)).toBe(true);
    expect(overCap(full, 'new', undefined)).toBe(false);
    expect(overCap(full, 'p0', undefined)).toBe(false);
    expect(overCap(full, 'p0', true)).toBe(false);
    expect(overCap({}, 'new', 'blue')).toBe(false);
  });
});
