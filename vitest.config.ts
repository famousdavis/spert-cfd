// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      // Declared explicitly although 'v8' is already the default: without it
      // nothing in this file mentions coverage, and the link to the
      // @vitest/coverage-v8 devDependency would be invisible at both sites.
      provider: 'v8',
      // Defaults are ['text', 'html', 'clover', 'json']; setting this key
      // REPLACES that list, so they are repeated here. `json-summary` is the
      // addition: istanbul's text reporter truncates filenames to a fixed
      // 19-character column, and the truncation correlates with file size, so
      // the largest files are exactly the ones unfindable by name. It also
      // interleaves directory rows with file rows, so a row count conflates
      // the two. Per-file figures are read from coverage-summary.json, never
      // by parsing the text table.
      reporter: ['text', 'html', 'clover', 'json', 'json-summary'],
      // Vitest 4 reports ONLY files loaded during the run unless `include` is
      // set, so a source file no test imports is ABSENT from the report rather
      // than present at 0%. Measured here: 41 of 82 files were missing, and
      // absent-versus-zero is the same thing to a human reading the table and
      // a different thing to a script.
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
