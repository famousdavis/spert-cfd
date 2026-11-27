// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.23.0 (FRAME26 clean-up L, contract §7): a new copy of the sample takes the
// sample's name while no project has it, else the lowest free "(n)", n ≥ 2.
// The caller passes every project's name; archived ones are in that list (the
// context test pins that), and the function cannot tell them apart.

import { describe, it, expect } from 'vitest';
import { SAMPLE_PROJECT_NAME, sampleLoadedText, sampleProjectName } from '../sample-name';

const BASE = 'Sample: 2-Week Sprint';

describe('sampleProjectName', () => {
  it('is the sample\'s own name, "Sample: …"', () => {
    expect(SAMPLE_PROJECT_NAME).toBe(BASE);
  });

  it('no projects: the base name', () => {
    expect(sampleProjectName([])).toBe(BASE);
  });

  it('other projects only: the base name', () => {
    expect(sampleProjectName(['Alpha', 'Beta'])).toBe(BASE);
  });

  it('the base taken: (2)', () => {
    expect(sampleProjectName([BASE])).toBe(`${BASE} (2)`);
  });

  it('the base and (2) taken: (3)', () => {
    expect(sampleProjectName([BASE, `${BASE} (2)`])).toBe(`${BASE} (3)`);
  });

  it('(2) taken but the base free: the base wins', () => {
    expect(sampleProjectName([`${BASE} (2)`])).toBe(BASE);
  });

  it('the lowest free number: base, (2) and (4) taken gives (3)', () => {
    expect(sampleProjectName([BASE, `${BASE} (2)`, `${BASE} (4)`])).toBe(`${BASE} (3)`);
  });

  it('an archived project holding the base name counts: (2)', () => {
    // Archive is each person's own setting, never on the project: an archived project is in the list as any other.
    const listed = [{ name: BASE, archived: true }, { name: 'Alpha', archived: false }];
    expect(sampleProjectName(listed.map((p) => p.name))).toBe(`${BASE} (2)`);
  });

  it('a person\'s own project named like a sample counts: their "(2)" with the base taken gives (3)', () => {
    expect(sampleProjectName([BASE, `${BASE} (2)`, 'My own'])).toBe(`${BASE} (3)`);
  });

  it('exact names only: a different case or spacing does not hold the name', () => {
    expect(sampleProjectName(['sample: 2-week sprint', `${BASE} `])).toBe(BASE);
  });
});

describe('sampleLoadedText', () => {
  it('is the contract\'s sentence, with curly quotes and the plural noun', () => {
    expect(sampleLoadedText(`${BASE} (2)`)).toBe('Added “Sample: 2-Week Sprint (2)” to your projects and opened it.');
  });
});
