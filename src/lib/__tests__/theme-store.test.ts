// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSystemDark } from '../../__tests__/match-media';

/**
 * The theme store (v0.20.0, DASH26 RD2, O33–O35): the preference in memory,
 * what a click does when saving fails, and what another tab's change does.
 * Each test takes a fresh store (`vi.resetModules`), since the preference is
 * read from storage once per page.
 */

type Theme = typeof import('../theme');
const fresh = async (): Promise<Theme> => {
  vi.resetModules();
  return import('../theme');
};
const isDark = () => document.documentElement.classList.contains('dark');

function quotaError(): Error {
  const e = new Error('The quota has been exceeded.');
  e.name = 'QuotaExceededError';
  return e;
}

let realLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  realLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
});

afterEach(() => {
  vi.restoreAllMocks();
  if (realLocalStorage) Object.defineProperty(window, 'localStorage', realLocalStorage);
  else delete (window as unknown as Record<string, unknown>).localStorage;
});

describe('the preference', () => {
  it('is read from storage once, then held in memory', async () => {
    localStorage.setItem('spert-theme', 'dark');
    const t = await fresh();
    expect(t.getPreference()).toBe('dark');
    localStorage.setItem('spert-theme', 'light'); // no event in this tab
    expect(t.getPreference()).toBe('dark');
  });

  it.each([
    [null, 'system'],
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    ['blue', 'system'],
    ['', 'system'],
  ])('stored %j reads as %s', async (stored, want) => {
    if (stored !== null) localStorage.setItem('spert-theme', stored);
    const t = await fresh();
    expect(t.getPreference()).toBe(want);
  });
});

describe('a click (choosePreference)', () => {
  it('saves, applies and tells the switch', async () => {
    const t = await fresh();
    const heard = vi.fn();
    t.subscribe(heard);
    t.choosePreference('dark');
    expect(localStorage.getItem('spert-theme')).toBe('dark');
    expect(isDark()).toBe(true);
    expect(t.getPreference()).toBe('dark');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('with the save refused (storage full): the page and the preference change, nothing throws, the stored value stays', async () => {
    localStorage.setItem('spert-theme', 'light');
    const t = await fresh();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });
    expect(() => t.choosePreference('dark')).not.toThrow();
    expect(isDark()).toBe(true);
    expect(t.getPreference()).toBe('dark');
    vi.restoreAllMocks();
    expect(localStorage.getItem('spert-theme')).toBe('light');
  });

  it('with getItem throwing: starts at System, and the click still applies', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const t = await fresh();
    expect(t.getPreference()).toBe('system');
    t.choosePreference('dark');
    expect(t.getPreference()).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('with the localStorage getter throwing (site data blocked): System, and the click applies without throwing', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('The operation is insecure.');
      },
    });
    setSystemDark(true);
    const t = await fresh();
    expect(t.getPreference()).toBe('system');
    t.applyTheme();
    expect(isDark()).toBe(true);
    expect(() => t.choosePreference('light')).not.toThrow();
    expect(isDark()).toBe(false);
  });
});

describe('System follows the computer; Light and Dark do not', () => {
  it('applyTheme reads the computer only for System', async () => {
    const t = await fresh();
    setSystemDark(true);
    t.applyTheme();
    expect(isDark()).toBe(true);
    setSystemDark(false);
    t.applyTheme();
    expect(isDark()).toBe(false);
    t.choosePreference('dark');
    setSystemDark(false);
    t.applyTheme();
    expect(isDark()).toBe(true);
    t.choosePreference('light');
    setSystemDark(true);
    t.applyTheme();
    expect(isDark()).toBe(false);
  });
});

describe('another tab (syncFromStorage)', () => {
  it('takes the event’s value by the rule, applies it and tells the switch', async () => {
    const t = await fresh();
    const heard = vi.fn();
    t.subscribe(heard);
    t.syncFromStorage('dark');
    expect(t.getPreference()).toBe('dark');
    expect(isDark()).toBe(true);
    t.syncFromStorage('blue');
    expect(t.getPreference()).toBe('system');
    t.syncFromStorage(null);
    expect(t.getPreference()).toBe('system');
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('an unsubscribed listener hears nothing', async () => {
    const t = await fresh();
    const heard = vi.fn();
    t.subscribe(heard)();
    t.choosePreference('dark');
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('only a click writes', () => {
  it('reading, applying and syncing never write to storage; a click does, once (must-find)', async () => {
    const t = await fresh();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    t.getPreference();
    t.applyTheme();
    t.syncFromStorage('dark');
    expect(setItem).not.toHaveBeenCalled();
    t.choosePreference('light');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith('spert-theme', 'light');
  });
});
