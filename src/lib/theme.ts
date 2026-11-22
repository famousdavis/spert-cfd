// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The theme preference (v0.20.0, DASH26 RD2): Light, Dark or System, stored
 * under SPERT® Forecaster's key `spert-theme`, System the default.
 *
 * One rule, here and in the pre-paint script alike (O33): anything but
 * `light`, `dark` or `system` (missing, invalid, unreadable) means System, and
 * System follows the computer. Dark means a `dark` class on `<html>`; every
 * colour follows that class through CSS (globals.css), so the preference is the
 * only theme state in JavaScript (O26).
 *
 * The preference lives in memory once read (O33 as amended): it is read from
 * storage once, changed by every click whether or not the save succeeds (O34:
 * storage full or blocked), and by `storage` events from CFD's other tabs
 * (O35). The switch shows it and `ThemeSync` applies it, so the two always
 * agree. After a refused save, this tab's next reload reverts to what is stored.
 *
 * Writers: the switch only, through `choosePreference`. `ThemeSync` and the
 * script never write.
 */

export const THEME_KEY = 'spert-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The rule: anything but a known preference means System. */
export function parsePreference(raw: string | null | undefined): ThemePreference {
  return PREFERENCES.includes(raw as ThemePreference) ? (raw as ThemePreference) : 'system';
}

/**
 * The stored preference. The read is wholly inside the `try`: with site data
 * blocked, Chrome throws from the `window.localStorage` getter itself, not
 * only from `getItem`.
 */
export function readStoredPreference(): ThemePreference {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(THEME_KEY);
  } catch {
    // Unreadable storage: System, by the rule.
  }
  return parsePreference(raw);
}

let current: ThemePreference | null = null;
const listeners = new Set<() => void>();

/** The preference in memory, read from storage the first time. */
export function getPreference(): ThemePreference {
  if (current === null) current = readStoredPreference();
  return current;
}

/** Whether the computer is set to dark. No fallback: every browser CFD runs in has `matchMedia`. */
export function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Puts the `dark` class on `<html>` when the preference resolves to dark, and takes it off otherwise. */
export function applyTheme(): void {
  const preference = getPreference();
  const dark = preference === 'dark' || (preference === 'system' && systemIsDark());
  document.documentElement.classList.toggle('dark', dark);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * The switch's click (the only writer). The page changes whether or not the
 * save succeeds (O34): a refused save only means the choice is not
 * remembered, and the other tabs, which hear of it only through storage, keep
 * their theme (O35).
 */
export function choosePreference(next: ThemePreference): void {
  current = next;
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage full or blocked: applied, not remembered.
  }
  applyTheme();
  notify();
}

/**
 * Another tab changed the preference: the `storage` event's own `newValue`
 * (null when that tab cleared storage), read by the rule, with no read of
 * storage here.
 */
export function syncFromStorage(newValue: string | null): void {
  current = parsePreference(newValue);
  applyTheme();
  notify();
}

/** For `useSyncExternalStore`: told of every change of the preference in this tab. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The pre-paint script, written into `<head>` by `layout.tsx`, so the first
 * frame is already in the right theme. Built from this module's key, values
 * and query, so it cannot drift from them; `theme-script.test.ts` runs this
 * very text against every stored value and both settings of the computer, and
 * checks the store gives the same answers. The read is inside its `try`, the
 * System fallback outside it (SPERT® Forecaster's form, `stored || 'system'`
 * inside one `try`, gives light for an invalid value or a throw).
 */
export const THEME_SCRIPT =
  `(function(){var p=null;try{p=window.localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}` +
  `var t=${JSON.stringify(PREFERENCES)}.indexOf(p)<0?"system":p;` +
  `if(t==="dark"||(t==="system"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches))` +
  `document.documentElement.classList.add("dark")})();`;
