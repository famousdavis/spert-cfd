// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// ErrorBoundary (v0.16.4) — app-shell now also puts one around the current
// tab, with a `fallback`, so an error in one tab leaves the header, the tabs
// and sign-out up. Without a fallback it is still the full-screen message.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../error-boundary';

let shouldThrow = true;
function View() {
  if (shouldThrow) throw new Error('a value the view cannot render');
  return <p>The view</p>;
}

describe('ErrorBoundary', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    shouldThrow = true;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('shows the full-screen message when it has no fallback', () => {
    render(<ErrorBoundary><View /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('shows its fallback in place of the view, and leaves the rest of the page', () => {
    render(
      <>
        <nav>Tabs</nav>
        <ErrorBoundary fallback={<p role="alert">This view could not be displayed.</p>}>
          <View />
        </ErrorBoundary>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toBe('This view could not be displayed.');
    expect(screen.getByText('Tabs')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('tries the view again when its key changes, as on a change of tab', () => {
    const fallback = <p role="alert">fallback</p>;
    const { rerender } = render(<ErrorBoundary key="projects:p1" fallback={fallback}><View /></ErrorBoundary>);
    shouldThrow = false;
    rerender(<ErrorBoundary key="settings:p1" fallback={fallback}><View /></ErrorBoundary>);
    expect(screen.getByText('The view')).toBeTruthy();
  });
});
