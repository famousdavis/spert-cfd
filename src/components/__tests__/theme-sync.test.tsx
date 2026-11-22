// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// @vitest-environment jsdom

import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { darkQueryListenerCount, setSystemDark } from '../../__tests__/match-media';

/**
 * ThemeSync (v0.20.0, DASH26 RD2, O33, O35): always mounted in the root
 * layout, it puts the class right when it mounts (React strips `<html>`'s
 * attributes whenever it renders the root on the client), follows the
 * computer while the preference is System and CFD's other tabs through the
 * `storage` event, renders nothing, never writes and never throws.
 */

const isDark = () => document.documentElement.classList.contains('dark');

async function mountFresh() {
  vi.resetModules(); // a fresh store, as on a page load
  const { ThemeSync } = await import('../theme-sync');
  const theme = await import('@/lib/theme');
  const view = render(<ThemeSync />);
  return { view, theme };
}

function storageEvent(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  });
}

let realLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  realLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (realLocalStorage) Object.defineProperty(window, 'localStorage', realLocalStorage);
  else delete (window as unknown as Record<string, unknown>).localStorage;
});

describe('ThemeSync', () => {
  it('renders nothing', async () => {
    const { view } = await mountFresh();
    expect(view.container.innerHTML).toBe('');
  });

  it('corrects a wrong class when it mounts: removes `dark` for a stored Light', async () => {
    localStorage.setItem('spert-theme', 'light');
    setSystemDark(true);
    document.documentElement.classList.add('dark');
    await mountFresh();
    expect(isDark()).toBe(false);
  });

  it('corrects a wrong class when it mounts: puts `dark` back (as after React strips <html>)', async () => {
    localStorage.setItem('spert-theme', 'dark');
    document.documentElement.className = '';
    await mountFresh();
    expect(isDark()).toBe(true);
  });

  it('follows the computer while System, and stops once Light or Dark is chosen', async () => {
    const { theme } = await mountFresh();
    expect(isDark()).toBe(false);
    act(() => setSystemDark(true));
    expect(isDark()).toBe(true);
    act(() => setSystemDark(false));
    expect(isDark()).toBe(false);
    act(() => theme.choosePreference('light'));
    act(() => setSystemDark(true));
    expect(isDark()).toBe(false);
  });

  it('follows another tab: the event’s value, by the rule; a cleared storage is System; other keys are ignored', async () => {
    const { theme } = await mountFresh();
    storageEvent('spert-theme', 'dark');
    expect(isDark()).toBe(true);
    expect(theme.getPreference()).toBe('dark');
    storageEvent('cfd-lab', 'whatever');
    expect(theme.getPreference()).toBe('dark');
    setSystemDark(false);
    storageEvent(null, null);
    expect(theme.getPreference()).toBe('system');
    expect(isDark()).toBe(false);
    storageEvent('spert-theme', 'blue');
    expect(theme.getPreference()).toBe('system');
  });

  it('never writes (must-find: a click does)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { theme } = await mountFresh();
    act(() => setSystemDark(true));
    storageEvent('spert-theme', 'dark');
    expect(setItem).not.toHaveBeenCalled();
    act(() => theme.choosePreference('light'));
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('never throws with the localStorage getter throwing (site data blocked): it applies System', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('The operation is insecure.');
      },
    });
    setSystemDark(true);
    await expect(mountFresh()).resolves.toBeDefined();
    expect(isDark()).toBe(true);
  });

  it('lets go of its listeners when it unmounts', async () => {
    const { view, theme } = await mountFresh();
    expect(darkQueryListenerCount()).toBe(1);
    view.unmount();
    expect(darkQueryListenerCount()).toBe(0);
    storageEvent('spert-theme', 'dark');
    expect(theme.getPreference()).toBe('system');
  });
});

describe('ThemeSync: before the browser paints (PR #111 review -03)', () => {
  it('has put the class back by the time a later sibling\'s layout effect runs (a passive effect would not)', async () => {
    localStorage.setItem('spert-theme', 'dark');
    document.documentElement.className = ''; // as after React strips <html>
    vi.resetModules();
    const { ThemeSync } = await import('../theme-sync');
    const seen: boolean[] = [];
    function Probe() {
      useLayoutEffect(() => {
        seen.push(document.documentElement.classList.contains('dark'));
      }, []);
      return null;
    }
    render(
      <>
        <ThemeSync />
        <Probe />
      </>,
    );
    expect(seen).toEqual([true]);
  });
});

describe('ThemeSync: a page restored from the back/forward cache (PR #111 review -02)', () => {
  /** pagehide / pageshow as a browser fires them; jsdom's events are built by hand so `persisted` is set. */
  function pageEvent(type: 'pagehide' | 'pageshow', persisted: boolean) {
    const event = new Event(type);
    Object.defineProperty(event, 'persisted', { value: persisted });
    act(() => {
      window.dispatchEvent(event);
    });
  }
  /** Errors thrown inside an event listener are reported to window, not thrown to dispatchEvent. */
  function collectReportedErrors() {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => {
      errors.push(e.error ?? e.message);
      e.preventDefault();
    };
    window.addEventListener('error', onError);
    return { errors, stop: () => window.removeEventListener('error', onError) };
  }

  it('follows a choice another tab stored while this page was cached (no storage event reached it)', async () => {
    localStorage.setItem('spert-theme', 'dark');
    const { theme } = await mountFresh();
    expect(isDark()).toBe(true);
    pageEvent('pagehide', true);
    localStorage.setItem('spert-theme', 'light'); // another tab's choice; this page heard nothing
    expect(isDark()).toBe(true);
    pageEvent('pageshow', true);
    expect(isDark()).toBe(false);
    expect(theme.getPreference()).toBe('light');
  });

  it('keeps this tab\'s own refused choice when nothing was stored meanwhile (O34)', async () => {
    localStorage.setItem('spert-theme', 'light');
    const { theme } = await mountFresh();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const e = new Error('The quota has been exceeded.');
      e.name = 'QuotaExceededError';
      throw e;
    });
    act(() => theme.choosePreference('dark')); // refused: storage still says light
    vi.restoreAllMocks();
    expect(localStorage.getItem('spert-theme')).toBe('light');
    pageEvent('pagehide', true);
    pageEvent('pageshow', true);
    expect(theme.getPreference()).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('applies the computer\'s current setting on restore while System', async () => {
    const { theme } = await mountFresh();
    expect(theme.getPreference()).toBe('system');
    pageEvent('pagehide', true);
    // The computer turned dark while the page was cached, and its change event was missed: the stub
    // does fire it here, so the class is taken off again by hand, as a browser that drops it would leave it.
    act(() => setSystemDark(true));
    document.documentElement.classList.remove('dark');
    pageEvent('pageshow', true);
    expect(isDark()).toBe(true);
  });

  it('a pageshow that is not a restore (persisted false) changes nothing', async () => {
    localStorage.setItem('spert-theme', 'dark');
    const { theme } = await mountFresh();
    pageEvent('pagehide', false);
    localStorage.setItem('spert-theme', 'light');
    pageEvent('pageshow', false);
    expect(theme.getPreference()).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('never throws when the read fails at pagehide or at pageshow', async () => {
    localStorage.setItem('spert-theme', 'dark');
    const { theme } = await mountFresh();
    const reported = collectReportedErrors();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    pageEvent('pagehide', true);
    getItem.mockRestore();
    localStorage.setItem('spert-theme', 'light');
    pageEvent('pageshow', true); // the hide-time read failed: nothing to compare, the preference stands
    expect(theme.getPreference()).toBe('dark');
    pageEvent('pagehide', true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    pageEvent('pageshow', true);
    reported.stop();
    expect(reported.errors).toEqual([]);
    expect(isDark()).toBe(true);
  });
});
