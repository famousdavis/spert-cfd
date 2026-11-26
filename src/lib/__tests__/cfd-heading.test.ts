// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// N9 (FRAME26, v0.22.0): the CFD tab's h1 (Orch-FRAME-2's D2). The loaded project's name, then UNNAMED_PROJECT,
// then "CFD" with none; the full name always in `title`, because the frame's heading is one line with an ellipsis
// (contract §7, "Long names"). jsdom has no layout, so the ellipsis itself is measured on the build (probe-x1).

import { describe, it, expect } from 'vitest';
import { cfdHeading } from '../cfd-heading';
import { UNNAMED_PROJECT } from '../cloud-load-guards';

describe('cfdHeading', () => {
  it('names the loaded project, with its full name in title', () => {
    expect(cfdHeading({ name: 'Sample: 2-Week Sprint' })).toEqual({ text: 'Sample: 2-Week Sprint', title: 'Sample: 2-Week Sprint' });
  });

  it('keeps a long name whole in both: the ellipsis is the stylesheet\'s, never a cut here', () => {
    const long = 'A project name long enough to run past the heading row at every width, '.repeat(4).trim();
    expect(cfdHeading({ name: long })).toEqual({ text: long, title: long });
  });

  it('reads a project with no name as the picker does', () => {
    expect(UNNAMED_PROJECT).toBe('Untitled project');
    expect(cfdHeading({ name: '' })).toEqual({ text: UNNAMED_PROJECT, title: UNNAMED_PROJECT });
  });

  it('is the tab\'s own name, "CFD", with no project open, and then no title', () => {
    expect(cfdHeading(null)).toEqual({ text: 'CFD' });
    expect(cfdHeading(undefined)).toEqual({ text: 'CFD' });
  });
});
