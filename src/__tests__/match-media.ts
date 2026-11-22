// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * A controllable `window.matchMedia` for jsdom tests (v0.20.0, DASH26 RD2).
 * jsdom has none, and the store deliberately has no fallback for its absence:
 * every browser CFD runs in has one. Installed for every jsdom file by
 * `setup-match-media.ts` (vitest `setupFiles`); a test sets the computer with
 * `setSystemDark` and the lists it handed out fire `change` as a browser's do.
 *
 * The state lives on `globalThis`, not in this module, so a test that calls
 * `vi.resetModules()` and imports this file again still drives the stub that
 * was installed.
 */

type ChangeListener = (event: MediaQueryListEvent) => void;

interface FakeList {
  media: string;
  listeners: Set<ChangeListener>;
}

interface StubState {
  dark: boolean;
  lists: Set<FakeList>;
}

const STATE_KEY = '__spertMatchMediaStub';
const DARK = '(prefers-color-scheme: dark)';

function state(): StubState {
  const g = globalThis as unknown as Record<string, StubState | undefined>;
  return (g[STATE_KEY] ??= { dark: false, lists: new Set() });
}

function matches(media: string): boolean {
  return media.replace(/\s+/g, ' ').trim() === DARK && state().dark;
}

export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string): MediaQueryList => {
      const list: FakeList = { media, listeners: new Set() };
      state().lists.add(list);
      return {
        media,
        get matches() {
          return matches(media);
        },
        onchange: null,
        addEventListener: (_type: string, listener: ChangeListener) => list.listeners.add(listener),
        removeEventListener: (_type: string, listener: ChangeListener) => list.listeners.delete(listener),
        addListener: (listener: ChangeListener) => list.listeners.add(listener),
        removeListener: (listener: ChangeListener) => list.listeners.delete(listener),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
    },
  });
}

/** Sets the computer to dark or light; every list for the dark query fires `change` when that flips its answer. */
export function setSystemDark(dark: boolean): void {
  const s = state();
  if (s.dark === dark) return;
  s.dark = dark;
  for (const list of s.lists) {
    if (list.media.replace(/\s+/g, ' ').trim() !== DARK) continue;
    for (const listener of [...list.listeners]) {
      listener({ matches: matches(list.media), media: list.media } as MediaQueryListEvent);
    }
  }
}

/** How many `change` listeners are attached to lists for the dark query. */
export function darkQueryListenerCount(): number {
  let n = 0;
  for (const list of state().lists) if (list.media.replace(/\s+/g, ' ').trim() === DARK) n += list.listeners.size;
  return n;
}

export function resetMatchMedia(): void {
  const s = state();
  s.dark = false;
  s.lists.clear();
}
