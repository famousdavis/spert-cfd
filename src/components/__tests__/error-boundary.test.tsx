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

  // v0.23.0 (FRAME26 clean-up C11, contract §7): the outermost crash screen stays outside the frame, on the page
  // ground in the frame's heading and muted colours, with a way to reload; one wording in every SPERT® app.
  it('the crash screen: page ground and text colours in both themes, the one wording, and Reload', () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    try {
      render(<ErrorBoundary><View /></ErrorBoundary>);
      const title = screen.getByRole('heading', { level: 1, name: 'Something went wrong' });
      const box = title.parentElement!;
      expect(box.className.split(' ')).toEqual(expect.arrayContaining(['min-h-screen', 'bg-white', 'dark:bg-[#101828]']));
      expect(title.className.split(' ')).toEqual(expect.arrayContaining(['text-[#333333]', 'dark:text-[#e2e8f0]']));
      expect(title.className).not.toMatch(/red/);
      const line = box.querySelector('p')!;
      expect(line.innerHTML).toBe('SPERT<span class="sf-mark">®</span> CFD could not display this page. Reload to try again.');
      expect(line.className.split(' ')).toEqual(expect.arrayContaining(['text-[#6a7282]', 'dark:text-[#99a1af]']));
      expect(box.textContent).not.toMatch(/local storage/);
      const button = screen.getByRole('button', { name: 'Reload' });
      button.click();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
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
