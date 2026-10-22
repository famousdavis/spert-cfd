#!/usr/bin/env node
// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Runs the emulator tier: the real createFirestoreDriver and the real contexts
 * against the Firestore emulator, loaded with the ruleset the landing-page
 * repository deploys.
 *
 *   npm run test:emulator                     # vitest run
 *   npm run test:emulator -- list --filesOnly # any other vitest arguments
 *
 * WHY A LAUNCHER RATHER THAN A PLAIN npm SCRIPT
 * ---------------------------------------------
 * 1. A JDK 21+. firebase-tools refuses any older Java. macOS ships a STUB
 *    /usr/bin/java that exits 1, and Homebrew's JDK is keg-only, so it is not
 *    on PATH. CI (ubuntu-latest) has an older default `java` and exposes its
 *    JDK 21+ only as JAVA_HOME_21_X64. This is the landing page's
 *    scripts/run-rules-tests.mjs search, with JAVA_HOME tried first.
 * 2. The rules live in another repository. They are fetched at the commit
 *    pinned in emulator-tests/rules-pin.json, checked against its md5, and
 *    cached by md5, so a re-run works offline. Testing against a copy whose
 *    provenance cannot be stated is the failure that looks like a success.
 *    Whether the pin is still what production enforces is a separate check:
 *    scripts/check-rules-pin.mjs.
 * 3. Nothing is written into the tree. firebase.json and the emulator's debug
 *    log go to a temp directory.
 *
 * THE RULE: no JDK 21+, a failed fetch or an md5 that disagrees EXITS NON-ZERO.
 * It never skips. A tier that quietly does nothing when its runtime is missing
 * looks identical to one that passed.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN = JSON.parse(readFileSync(join(ROOT, 'emulator-tests', 'rules-pin.json'), 'utf8'));
// A demo- project id: the emulator then refuses to reach any real service.
const PROJECT_ID = 'demo-spert-cfd';
const PORT = Number(process.env.SPERT_EMULATOR_PORT ?? 8180);
const MIN_JDK = 21;

function fail(lines) {
  console.error(['', ...lines, ''].join('\n'));
  process.exit(1);
}

// ── JDK ─────────────────────────────────────────────────────────────────────

/** Major version of the JDK at `binDir` (or on PATH), or 0 if unusable. */
function javaMajor(binDir) {
  const exe = binDir ? join(binDir, 'java') : 'java';
  if (binDir && !existsSync(exe)) return 0;
  const r = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  if (r.status !== 0) return 0;
  // `java -version` writes to stderr. Modern: openjdk version "21.0.4".
  // Legacy: java version "1.8.0_202" — there the major is the second field.
  const m = /version "(\d+)(?:\.(\d+))?/.exec(`${r.stderr}${r.stdout}`);
  if (!m) return 0;
  const first = Number(m[1]);
  return first === 1 ? Number(m[2] ?? 0) : first;
}

/** GitHub runners expose each installed JDK as JAVA_HOME_<major>_<arch>; highest first. */
function runnerJdkBinDirs() {
  return Object.entries(process.env)
    .map(([k, v]) => [/^JAVA_HOME_(\d+)_/.exec(k), v])
    .filter(([m, v]) => m && v && Number(m[1]) >= MIN_JDK)
    .sort((a, b) => Number(b[0][1]) - Number(a[0][1]))
    .map(([, v]) => join(v, 'bin'));
}

function macJavaHome() {
  const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' });
  return r.status === 0 ? join(r.stdout.trim(), 'bin') : null;
}

/** The bin directory to put first on PATH; null when PATH's java will do; undefined when none will. */
function resolveJavaBinDir() {
  const fromJavaHome = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin') : null;
  if (fromJavaHome && javaMajor(fromJavaHome) >= MIN_JDK) return fromJavaHome;
  if (javaMajor(null) >= MIN_JDK) return null;
  const candidates = [
    ...runnerJdkBinDirs(), // CI lands here
    '/opt/homebrew/opt/openjdk/bin', // Homebrew, Apple Silicon
    '/usr/local/opt/openjdk/bin', // Homebrew, Intel
    macJavaHome(),
  ].filter(Boolean);
  return candidates.find((dir) => javaMajor(dir) >= MIN_JDK);
}

const javaBinDir = resolveJavaBinDir();
if (javaBinDir === undefined) {
  fail([
    `Cannot run the emulator tests: no JDK ${MIN_JDK}+ found.`,
    `Tried JAVA_HOME (${process.env.JAVA_HOME || 'unset'}), java on PATH (major ${javaMajor(null) || 'none'}),`,
    'JAVA_HOME_<major>_X64, Homebrew openjdk and /usr/libexec/java_home.',
    '  macOS:  brew install openjdk',
    `  Linux:  apt-get install -y openjdk-${MIN_JDK}-jre-headless`,
    'Failing rather than skipping: a skipped tier is indistinguishable from a passed one.',
  ]);
}

// ── Rules, pinned and md5-checked ───────────────────────────────────────────

const md5 = (buf) => createHash('md5').update(buf).digest('hex');
const rulesUrl = `https://raw.githubusercontent.com/${PIN.repo}/${PIN.commit}/${PIN.path}`;
const cacheDir = join(ROOT, 'node_modules', '.cache', 'spert-cfd-emulator');
const rulesFile = join(cacheDir, `${PIN.md5}.rules`);
let rulesSource = 'cached';

if (existsSync(rulesFile)) {
  const got = md5(readFileSync(rulesFile));
  if (got !== PIN.md5) {
    fail([`Cached rules ${rulesFile} have md5 ${got}, but the pin says ${PIN.md5}.`, 'Delete the file to fetch it again.']);
  }
} else {
  let res;
  try {
    res = await fetch(rulesUrl);
  } catch (err) {
    fail([`Could not fetch the pinned rules: ${err.message}`, rulesUrl]);
  }
  if (!res.ok) fail([`Fetching the pinned rules returned HTTP ${res.status}.`, rulesUrl]);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = md5(bytes);
  if (got !== PIN.md5) fail([`The pinned rules have md5 ${got}, but the pin says ${PIN.md5}.`, rulesUrl]);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(rulesFile, bytes);
  rulesSource = 'fetched';
}

// ── Emulator ────────────────────────────────────────────────────────────────

const work = mkdtempSync(join(tmpdir(), 'spert-cfd-emulator-'));
const firebaseJson = join(work, 'firebase.json');
writeFileSync(
  firebaseJson,
  JSON.stringify({
    emulators: {
      firestore: { host: '127.0.0.1', port: PORT, websocketPort: PORT + 1 },
      hub: { host: '127.0.0.1', port: PORT + 2 },
      logging: { host: '127.0.0.1', port: PORT + 3 },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  }),
);

const sh = (s) => `'${s.replaceAll("'", "'\\''")}'`;
const vitestArgs = process.argv.length > 2 ? process.argv.slice(2) : ['run'];
const script = [
  'cd', sh(ROOT), '&&',
  sh(join(ROOT, 'node_modules', '.bin', 'vitest')), ...vitestArgs.map(sh),
  '--config', sh(join(ROOT, 'vitest.emulator.config.ts')),
].join(' ');

const env = { ...process.env, SPERT_RULES_FILE: rulesFile };
if (javaBinDir) env.PATH = `${javaBinDir}:${env.PATH}`;

console.log(
  `emulator tier: JDK ${javaMajor(javaBinDir)} · rules ${PIN.repo}@${PIN.commit.slice(0, 7)} ${PIN.path} md5 ${PIN.md5} (${rulesSource})`,
);

const result = spawnSync(
  join(ROOT, 'node_modules', '.bin', 'firebase'),
  ['emulators:exec', '--config', firebaseJson, '--only', 'firestore', '--project', PROJECT_ID, script],
  { cwd: work, stdio: 'inherit', env },
);

if (result.error) {
  fail([`Failed to launch the Firebase CLI: ${result.error.message}`, 'firebase-tools is a devDependency: run npm ci.']);
}
if (result.status === 0) rmSync(work, { recursive: true, force: true });
else console.error(`Emulator logs kept in ${work}`);
process.exit(result.status ?? 1);
