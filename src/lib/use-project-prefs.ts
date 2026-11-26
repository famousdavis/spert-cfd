// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useStorage } from '@/contexts/storage-context';
import type { PrefsRead } from './project-prefs';

const LOADING: PrefsRead = { status: 'loading' };

/**
 * The person's tile colours and archive as the active driver holds them
 * (v0.21.0, DASH26 R2). The driver is the one store: it reads the map, holds
 * it for the session and writes each change, so every reader (the Projects
 * tab, the CFD tab's picker, Keep local copy) sees the same map and changes
 * with it. A driver swap (sign-in, sign-out, Switch) brings the new driver's
 * map; the old one goes with its driver, after its pending writes were sent
 * (`flush`) or, at sign-out, dropped (`cancelPendingSaves`).
 */
export function useProjectPrefs(): PrefsRead {
  const { driver } = useStorage();
  const subscribe = useCallback((onChange: () => void) => driver.onProjectPrefsChange(onChange), [driver]);
  const read = useCallback(() => driver.getProjectPrefs(), [driver]);
  return useSyncExternalStore(subscribe, read, () => LOADING);
}
