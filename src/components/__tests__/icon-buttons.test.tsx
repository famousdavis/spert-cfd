// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R1a): the tile's icon buttons draw SPERT® Forecaster's glyphs
// (`src/shared/components/*IconButton.tsx` at df59b2d). Each svg is pinned whole,
// children and attributes, as rendered: Share is not one path but a path, a
// circle and two lines, and a check of paths alone would miss its lines.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportIconButton, PencilIconButton, ShareIconButton, TrashIconButton } from '../icons/icon-buttons';

const stroked = (d: string) =>
  `<path d="${d}" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>`;

const EXPECTED: Array<[string, typeof TrashIconButton, string, string]> = [
  ['Trash', TrashIconButton, 'width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"',
    stroked('M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6')],
  ['Export', ExportIconButton, 'width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"',
    stroked('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')],
  ['Pencil', PencilIconButton, 'width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"',
    stroked('M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z')],
  ['Share', ShareIconButton, 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"',
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line>'],
];

describe('icon buttons', () => {
  it.each(EXPECTED)('%s draws Forecaster\'s glyph, whole', (_name, Button, svgAttrs, children) => {
    render(<Button onClick={vi.fn()} ariaLabel="Act" title="Act" />);
    const svg = screen.getByRole('button', { name: 'Act' }).querySelector('svg')!;
    expect(svg.outerHTML).toBe(`<svg ${svgAttrs}>${children}</svg>`);
  });

  it('a disabled button keeps its name and points at its reason', () => {
    render(<TrashIconButton onClick={vi.fn()} ariaLabel="Delete X" title="Why" disabled describedBy="why" />);
    const b = screen.getByRole('button', { name: 'Delete X' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-describedby')).toBe('why');
    expect(b.title).toBe('Why');
    expect(b.type).toBe('button');
  });
});
