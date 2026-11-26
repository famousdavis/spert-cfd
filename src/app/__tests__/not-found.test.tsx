// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N12 (FRAME26, v0.22.0; Orch-FRAME-2's D7): an unknown address shows a framed 404 in SPERT® MyScrumBudget's and
// Scheduler's words: the frame's heading row, one line, and a link back to Projects. The frame itself is AppShell's
// (frame-pages.test.tsx); until v0.22.0 it was Next's own frameless page, a window-tall "404".

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '../not-found';

describe('the 404', () => {
  it('is the frame\'s heading row, "Page not found", then the body', () => {
    const { container } = render(<NotFound />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Page not found');
    expect(h1.getAttribute('data-sf')).toBe('heading');
    expect(h1.parentElement!.getAttribute('data-sf')).toBe('headrow');
    expect(container.children).toHaveLength(2);
    expect(container.children[1].className).toBe('sf-below');
    expect(screen.getByText('There’s no page at this address.'.replace('’', "'"))).toBeTruthy();
  });

  it('links back to Projects, at "/"', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: 'Back to Projects' }).getAttribute('href')).toBe('/');
  });
});
