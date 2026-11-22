// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// vitest `setupFiles` (v0.20.0, DASH26 RD2): a controllable `matchMedia` in
// every jsdom test file (see match-media.ts). Most files run in `node`, where
// there is no window, and get nothing.
import { afterEach } from 'vitest';
import { installMatchMedia, resetMatchMedia } from './match-media';

if (typeof window !== 'undefined') {
  installMatchMedia();
  afterEach(() => resetMatchMedia());
}
