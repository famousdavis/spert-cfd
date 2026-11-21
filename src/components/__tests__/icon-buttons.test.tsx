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
import { CloneIconButton, ExportIconButton, PencilIconButton, ShareIconButton, TrashIconButton } from '../icons/icon-buttons';
import { ICON_HUE_VIOLET } from '../icons/icon-button-styles';

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
  // v0.19.0 (DASH26 R1b): Forecaster's CloneIconButton.tsx at df59b2d, a rect and a path.
  ['Clone', CloneIconButton, 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"',
    '<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'],
];

describe('icon buttons', () => {
  it.each(EXPECTED)('%s draws Forecaster\'s glyph, whole', (_name, Button, svgAttrs, children) => {
    render(<Button onClick={vi.fn()} ariaLabel="Act" title="Act" />);
    const svg = screen.getByRole('button', { name: 'Act' }).querySelector('svg')!;
    expect(svg.outerHTML).toBe(`<svg ${svgAttrs}>${children}</svg>`);
  });

  it('Clone takes Forecaster\'s violet: #7c3aed on #f5f3ff with a 1.5 px ring, #a78bfa on a 15 % tint in dark', () => {
    render(<CloneIconButton onClick={vi.fn()} ariaLabel="Clone X" title="Clone project" />);
    const cls = screen.getByRole('button', { name: 'Clone X' }).className;
    expect(cls).toContain(ICON_HUE_VIOLET);
    for (const c of [
      'enabled:hover:text-[#7c3aed]', 'enabled:hover:bg-[#f5f3ff]', 'enabled:hover:shadow-[0_0_0_1.5px_rgba(139,92,246,0.5)]',
      'enabled:focus:text-[#7c3aed]', 'dark:enabled:hover:text-[#a78bfa]', 'dark:enabled:hover:bg-[rgba(139,92,246,0.15)]',
      'text-[#808080]',
    ]) expect(cls.split(' ')).toContain(c);
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
