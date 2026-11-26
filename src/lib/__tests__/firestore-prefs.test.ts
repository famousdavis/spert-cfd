// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.21.0 (DASH26 R2, O52): the write's payload and mask, with the real SDK's
// FieldPath and deleteField. What the server stores is pinned on the emulator
// (emulator-tests/project-prefs.test.ts), as raw documents.
import { describe, it, expect } from 'vitest';
import { deleteField, FieldPath } from 'firebase/firestore';
import { buildProjectPrefsWrite } from '../firestore-prefs';

const paths = (mask: FieldPath[]) => mask.map((p) => p.isEqual(new FieldPath('projectPrefs', 'x', 'y')) ? 'never' : p);

describe('buildProjectPrefsWrite', () => {
  it('one FieldPath per (id, field), a value or deleteField(), the payload holding exactly the masked fields', () => {
    const { payload, mask } = buildProjectPrefsWrite(
      [{ id: 'a', field: 'color' }, { id: 'a', field: 'archived' }, { id: 'b', field: 'color' }, { id: 'a', field: 'color' }],
      { a: { color: 'teal' } },
    );
    expect(mask).toHaveLength(3);
    expect(mask[0].isEqual(new FieldPath('projectPrefs', 'a', 'color'))).toBe(true);
    expect(mask[1].isEqual(new FieldPath('projectPrefs', 'a', 'archived'))).toBe(true);
    expect(mask[2].isEqual(new FieldPath('projectPrefs', 'b', 'color'))).toBe(true);
    expect(payload.projectPrefs.a.color).toBe('teal');
    expect(payload.projectPrefs.a.archived).toEqual(deleteField()); // the real sentinel, not a map
    const sentinel = (v: unknown) => v as ReturnType<typeof deleteField>;
    expect(sentinel(payload.projectPrefs.a.archived).isEqual(deleteField())).toBe(true);
    expect(sentinel(payload.projectPrefs.b.color).isEqual(deleteField())).toBe(true);
    expect(Object.keys(payload)).toEqual(['projectPrefs']); // nothing else: no seed, no schemaVersion (O41)
    expect(paths(mask)).not.toContain('never');
  });

  it('a dotted id is one segment, and a refused id writes nothing', () => {
    const { payload, mask } = buildProjectPrefsWrite([{ id: 'x.y', field: 'archived' }, { id: 'hasOwnProperty', field: 'archived' }, { id: '__proto__', field: 'color' }], {});
    expect(mask).toHaveLength(1);
    expect(mask[0].isEqual(new FieldPath('projectPrefs', 'x.y', 'archived'))).toBe(true);
    expect(Object.keys(payload.projectPrefs)).toEqual(['x.y']);
  });
});
