// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.17.0: the two app-wide notices. The terms notice shows until "Got it",
// for good. The local-storage caution shows on each page load while storage
// is local; "Got it" hides it until the next load, and the only permanent
// off-switch is the Settings (and Cloud Storage window) switch — there is no
// "Don't show again" on the caution itself.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const storage = vi.hoisted(() => ({ value: { driver: { mode: 'local' as 'local' | 'cloud' } } }));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => storage.value,
}));

import { FirstRunBanner } from '../first-run-banner';
import { LocalStorageWarningBanner } from '../local-storage-warning-banner';
import { LocalWarningSetting } from '../local-warning-setting';
import { LS_FIRST_RUN_SEEN, LS_SUPPRESS_LS_WARNING, TOS_URL, PRIVACY_URL } from '@/lib/constants';

const CAUTION = /Your data exists only in this browser/;
const TERMS = /SPERT® Suite web apps are free to use/;
const SWITCH = 'Warn me on startup when using local storage';

beforeEach(() => {
  localStorage.clear();
  storage.value = { driver: { mode: 'local' } };
});

describe('the terms notice', () => {
  it('shows on a first visit, with both links, and "Got it" dismisses it for good', () => {
    const { unmount } = render(<FirstRunBanner />);
    expect(screen.getByText(TERMS)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe(TOS_URL);
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(PRIVACY_URL);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(TERMS)).toBeNull();
    expect(localStorage.getItem(LS_FIRST_RUN_SEEN)).toBe('true');
    unmount();
    render(<FirstRunBanner />); // the next page load
    expect(screen.queryByText(TERMS)).toBeNull();
  });
});

describe('the local-storage caution', () => {
  it('shows in local mode, with "Got it" and no "Don\'t show again" control', () => {
    render(<LocalStorageWarningBanner />);
    expect(screen.getByText(CAUTION)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/Don.t show again/)).toBeNull();
  });

  it('"Got it" hides it for this page load only: it writes nothing, and the next load shows it again', () => {
    const { rerender, unmount } = render(<LocalStorageWarningBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(CAUTION)).toBeNull();
    rerender(<LocalStorageWarningBanner />); // a re-render inside the app (a tab change) keeps it hidden
    expect(screen.queryByText(CAUTION)).toBeNull();
    expect(localStorage.getItem(LS_SUPPRESS_LS_WARNING)).toBeNull();
    unmount();
    render(<LocalStorageWarningBanner />); // the next page load
    expect(screen.getByText(CAUTION)).toBeTruthy();
  });

  it('does not show while storage is in the cloud', () => {
    storage.value = { driver: { mode: 'cloud' } };
    render(<LocalStorageWarningBanner />);
    expect(screen.queryByText(CAUTION)).toBeNull();
  });

  it('does not show once the user turned the warning off', () => {
    localStorage.setItem(LS_SUPPRESS_LS_WARNING, 'true');
    render(<LocalStorageWarningBanner />);
    expect(screen.queryByText(CAUTION)).toBeNull();
  });
});

describe('the Settings switch for the caution', () => {
  it('is on by default, with its description', () => {
    render(<LocalWarningSetting />);
    expect((screen.getByRole('checkbox', { name: SWITCH }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Shows a caution banner each time the app opens while your data is stored locally in this browser.')).toBeTruthy();
  });

  it('turning it off stops the caution from the next page load; turning it on brings it back', () => {
    render(<LocalWarningSetting />);
    const box = screen.getByRole('checkbox', { name: SWITCH }) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    expect(localStorage.getItem(LS_SUPPRESS_LS_WARNING)).toBe('true');
    const caution = render(<LocalStorageWarningBanner />);
    expect(screen.queryByText(CAUTION)).toBeNull();
    caution.unmount();

    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(localStorage.getItem(LS_SUPPRESS_LS_WARNING)).toBeNull();
    render(<LocalStorageWarningBanner />);
    expect(screen.getByText(CAUTION)).toBeTruthy();
  });

  it('reads the saved choice, the same key the Cloud Storage window writes', () => {
    localStorage.setItem(LS_SUPPRESS_LS_WARNING, 'true');
    render(<LocalWarningSetting />);
    expect((screen.getByRole('checkbox', { name: SWITCH }) as HTMLInputElement).checked).toBe(false);
  });
});
