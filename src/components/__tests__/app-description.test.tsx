// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.17.9: the header shows CFD's tagline under its title, and the About tab's
// italic subtitle shows the same words. Both read APP_DESCRIPTION.
//
// ⚠️ The words are compared with a LITERAL, never with APP_DESCRIPTION: a test
// that imported the constant would agree with whatever was written there, and
// would stay green if either screen stopped reading it.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ mode: 'local' }),
}));

import { AppHeader } from '../app-header';
import { AboutTab } from '../about-tab';

const TAGLINE = 'Cumulative Flow Diagram tool for agile teams';

describe('the tagline, "Cumulative Flow Diagram tool for agile teams"', () => {
  it('is shown in the header, under the title', () => {
    const { container } = render(<AppHeader onNavigateHome={vi.fn()} onOpenModal={vi.fn()} />);
    const header = container.querySelector('header') as HTMLElement;
    const line = screen.getByText(TAGLINE);
    expect(header.contains(line)).toBe(true);
    // v0.22.0 (FRAME26): beside the title, as the frame's tagline: after the
    // title in document order, not inside it. The title is no longer an h1.
    const title = header.querySelector('[data-sf="title"]') as HTMLElement;
    expect(title.contains(line)).toBe(false);
    expect(title.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // v0.22.0 (FRAME26): the heading, "About SPERT® CFD", is the frame's heading
  // row, rendered by AppShell above the tab's body (frame-pages.test.tsx); the
  // subtitle is the body's first line.
  it('is the About tab’s subtitle, the first line of its body, under its heading row', () => {
    const { container } = render(<AboutTab />);
    const line = screen.getByText(TAGLINE);
    expect(container.firstElementChild!.firstElementChild).toBe(line);
  });
});
