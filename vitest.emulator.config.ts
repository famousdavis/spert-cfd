// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { defineConfig } from 'vitest/config'
import path from 'path'

// The emulator tier: the real Firestore driver and contexts against the
// Firestore emulator, under the rules the landing-page repo deploys.
//
// SEPARATE from vitest.config.ts on purpose. These tests need a JDK 21+, the
// emulator and (on the first run) the network, so they must never join
// `npm test`, which stays Java-free. vitest.config.ts includes only `src/**`,
// so it cannot pick these up. Run them with `npm run test:emulator`
// (scripts/run-emulator-tests.mjs), never with `vitest` directly: the global
// setup refuses to start without the emulator and the pinned rules.
export default defineConfig({
  // The launcher starts vitest from the repo root; pinning root here keeps
  // the include patterns right whatever the working directory.
  root: __dirname,
  test: {
    globals: true,
    // jsdom for every file: the driver dispatches its access-revoked event on
    // `window`, and the provider tests need it anyway.
    environment: 'jsdom',
    include: ['emulator-tests/**/*.test.ts', 'emulator-tests/**/*.test.tsx'],
    globalSetup: ['emulator-tests/global-setup.ts'],
    // Real round trips, offline/online flips and a 200 ms save debounce.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One emulator, shared by every file.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
