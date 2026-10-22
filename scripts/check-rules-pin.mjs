#!/usr/bin/env node
// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Is the emulator tier still testing the rules production enforces?
 *
 * The tier loads firestore.rules at the commit pinned in
 * emulator-tests/rules-pin.json. A pin that falls behind keeps passing
 * against rules production no longer runs, which is the failure that looks
 * like a success. This compares the pin's md5 with the landing page's `main`,
 * which is what production enforces: CI there deploys the rules on merge, and
 * a scheduled job checks the deployed ruleset against the file.
 *
 * Exit 1 when they differ. Run by .github/workflows/rules-pin.yml, daily, on
 * pull requests and on demand. ⚠️ It is deliberately NOT a ship-gate step and
 * NOT a required check: a rules change in the landing page should show here
 * as a red X, not block an unrelated CFD fix. Node built-ins only.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN = JSON.parse(readFileSync(join(ROOT, 'emulator-tests', 'rules-pin.json'), 'utf8'));
const url = `https://raw.githubusercontent.com/${PIN.repo}/main/${PIN.path}`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`Could not read ${url}: HTTP ${res.status}`);
  process.exit(1);
}
const current = createHash('md5').update(Buffer.from(await res.arrayBuffer())).digest('hex');

if (current === PIN.md5) {
  console.log(`Rules pin is current: ${PIN.repo}@${PIN.commit.slice(0, 7)} ${PIN.path} md5 ${PIN.md5} = main.`);
  process.exit(0);
}

console.error(
  [
    `Rules pin is STALE: ${PIN.repo} main's ${PIN.path} has md5 ${current};`,
    `the emulator tier tests md5 ${PIN.md5} (@${PIN.commit.slice(0, 7)}).`,
    '',
    'To bring it up to date, in emulator-tests/rules-pin.json set',
    `  commit: the output of  git ls-remote https://github.com/${PIN.repo} main`,
    `  md5:    ${current}`,
    'then run npm run test:emulator against the new rules.',
  ].join('\n'),
);
process.exit(1);
