// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useLayoutEffect } from 'react';
import { DARK_QUERY, THEME_KEY, applyTheme, syncFromStorage } from '@/lib/theme';

/**
 * Keeps the `dark` class on `<html>` right on every route (v0.20.0, DASH26
 * RD2, O33). Mounted once in the root layout, outside `AppShell`, so it is
 * there when the header and its switch are not: on `/changelog`, on the
 * loading screen, during a storage switch and on the crash screen.
 *
 * - When it mounts, before the browser paints, it applies the preference.
 *   React removes every attribute of `<html>` whenever it renders the root on
 *   the client (an error while hydrating, as with storage blocked), the
 *   pre-paint script's class included; this component mounts again in that
 *   same commit and puts the class back.
 * - It follows the computer while the preference is System, and CFD's other
 *   tabs through the `storage` event (O35).
 *
 * It renders nothing and never writes. It must never throw: it sits outside
 * every error boundary, so a throw here would replace all of CFD with Next's
 * global error page. Every storage access in `theme.ts` is guarded.
 */
export function ThemeSync(): null {
  useLayoutEffect(() => {
    applyTheme();
    const query = window.matchMedia(DARK_QUERY);
    const onComputerChange = () => applyTheme();
    const onStorage = (event: StorageEvent) => {
      // `null`: another tab cleared storage, so the preference is gone.
      if (event.key === THEME_KEY || event.key === null) syncFromStorage(event.newValue);
    };
    query.addEventListener('change', onComputerChange);
    window.addEventListener('storage', onStorage);
    return () => {
      query.removeEventListener('change', onComputerChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return null;
}
