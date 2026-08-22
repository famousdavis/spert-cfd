// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  { ignores: [".claude/**"] },
  ...nextVitals,
  ...nextTs,
  // `.stryker-tmp` would hold Stryker's sandbox COPIES of every mutated file,
  // including deliberately broken source mid-run. Ignoring it is not optional
  // once `expectProblems` is live: MyScrumBudget measured 522 problems against
  // a baseline of 14 from exactly this, and the gate fails saying "new problems
  // were introduced" while naming Stryker nowhere.
  //
  // Stryker is NOT installed here — this is the one pre-emptive entry, and it is
  // deliberately the only one. `reports/**` was proposed alongside it and
  // dropped: it is a generic directory name with nothing generating it here, and
  // an over-broad ignore is UNDETECTABLE under a count-based ratchet — the
  // ratchet fires when the count changes, and silently unlinting a directory
  // keeps it stable. Its failure mode is precisely the one the guard cannot see.
  // Add `reports/**` alongside Stryker itself if mutation testing lands.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".stryker-tmp/**",
    "next-env.d.ts",
  ]),
  // Cognitive complexity ONLY — not `sonarjs.configs.recommended`. The plugin is
  // here to answer "where is this code hard to change safely?", and nothing else.
  // Measured at spert-forecaster on one day: the narrow rule found 10 findings,
  // `recommended` found 103, and the 103 was not the 10 plus signal — roughly 21
  // were false positives for that codebase. Threshold 15 and plugin 4.0.3 match
  // GanttApp, MyScrumBudget, spert-forecaster and spert-story-map, so this
  // baseline stays comparable to theirs. spert-scheduler runs `recommended` and
  // its number is NOT comparable.
  //
  // `files:` scopes the rule to TS/TSX by construction, which keeps
  // `scripts/*.mjs` outside it. `scripts/shipgate.mjs` is byte-identical across
  // nine repos, and a plugin-specific disable directive in it once broke CI in
  // six siblings at once because they do not install sonarjs. Scope it here;
  // never put a sonarjs directive in that file.
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { sonarjs },
    rules: { "sonarjs/cognitive-complexity": ["error", 15] },
  },
  {
    rules: {
      // Honour two intentional patterns the codebase already uses:
      //   - `_`-prefixed params/vars marked deliberately unused
      //     (cloud-only stub methods, reserved props on extracted
      //     sub-component contracts)
      //   - destructure-to-strip with a `...rest` sibling, used in
      //     firestore-driver.ts to peel cloud-only fields off a
      //     project before exporting the rest.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
