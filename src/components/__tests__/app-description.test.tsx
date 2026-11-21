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
    const { container } = render(<AppHeader onOpenModal={vi.fn()} />);
    const header = container.querySelector('header') as HTMLElement;
    const line = screen.getByText(TAGLINE);
    expect(header.contains(line)).toBe(true);
    // Under the title: after the h1 in document order, not inside it.
    const h1 = header.querySelector('h1') as HTMLElement;
    expect(h1.contains(line)).toBe(false);
    expect(h1.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is the About tab’s subtitle, directly under its heading', () => {
    render(<AboutTab />);
    const heading = screen.getByRole('heading', { level: 2, name: /About SPERT/ });
    const line = screen.getByText(TAGLINE);
    expect(heading.nextElementSibling).toBe(line);
  });
});
