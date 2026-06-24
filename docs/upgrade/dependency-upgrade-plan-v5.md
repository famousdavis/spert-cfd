# spert-cfd Dependency Upgrade — Implementation Plan v5
# Date: 2026-06-23 · Repo: spert-cfd · Starting version: v0.14.0 · Firm target: v0.14.6
---
## Overview
This plan upgrades spert-cfd from v0.14.0 to v0.14.6 across six firm PRs, plus conditional
follow-ups. PR A is a security regen that clears all 12 advisory keys to 0 via overrides +
full lockfile regen, followed by five currency and maintenance PRs. Three conditional
follow-ups (recharts, @types/react, vitest ceiling) execute when their soak windows clear.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 ·
Recharts 3 · Firebase client SDK · Vitest 4 · date-fns 4 · @dnd-kit
**Gate sequence (all PRs):**
1. Edit version surfaces (package.json, constants.ts, CHANGELOG.md)
2. Run version-surface consistency check
3. Run CHANGELOG self-check
4. `rm -rf .next && npm run build && npm run lint && npm test`
5. Run audit gate
`next build` type-checks `src/lib/constants.ts` (a version mismatch there is a syntax
error). However, `next build` does not validate `package.json` "version" or `CHANGELOG.md`
content — the consistency check (step 2) and per-PR browser load are the only guards for
those two surfaces. Next 16 also does not run ESLint during `next build`, so `npm run lint`
is an explicit, separate gate step (step 4).
**Deploy:** Auto-deploy on push to main via Vercel git integration (no `vercel.json`).
Every merged PR triggers a build and deploy. "Deploy: YES" means the shipped runtime
artifact changes and requires visual smoke. "Deploy: NO" means the artifact is byte-stable
but Vercel still builds on merge. Confirm that Vercel is configured to build branch/PR
previews before PR A — the pre-merge smoke depends on the preview URL existing.
**APP_VERSION and DATA_VERSION:** `src/lib/migrations.ts` exports `DATA_VERSION =
APP_VERSION`. Each version bump re-stamps user documents with the new version on next load.
This is benign throughout the campaign because `INDEX_MIGRATIONS` and `PROJECT_MIGRATIONS`
are both empty arrays — no transform fires. Verify this invariant holds before each PR:
```bash
grep -A3 "INDEX_MIGRATIONS\|PROJECT_MIGRATIONS" src/lib/migrations.ts
```
**Version surfaces (3 per PR — edit all before running the gate):**
1. `package.json` → `"version"` field
2. `src/lib/constants.ts` → `APP_VERSION = 'x.y.z'`
3. `CHANGELOG.md` → new top entry below the `# Changelog` H1 and intro, above the prior
   `## v…` entry. Format must match `src/app/changelog/page.tsx`'s regex exactly:
   `## vX.Y.Z — <subtitle> (Month DD, YYYY)` then optional prose, then `### Fixed` /
   `### Changed` subsections with `- Bullet text.` items.
   **Every bullet must be a single physical line** — the parser collects only lines starting
   with `- `; a wrapped continuation is silently dropped. A malformed header silently drops
   the entire entry without failing the build. `### Fixed`/`### Changed` headers are
   flattened in the in-app render — all bullets appear in one ungrouped list; do not read
   this as a defect during smoke. Tag convention: existing entries use issue-reference tags
   (`(E1)`, `(K2)` etc.); upgrade PRs use descriptive category tags (`(security)`, `(deps)`).
**Exact pins persist:** The regen in PR A converts all `^`/`~` specifiers in `dependencies`
and `devDependencies` to exact versions. This is intentional and permanent. PRs B–F edit one
specifier at a time and leave all others exact. The `overrides` block retains range values
by design (`^7.6.3`, `~1.9.16`, `^8.0.16`).
**Between-PR sync:** After each PR merges: `git checkout main && git pull --ff-only`. Never
cut the next branch until the prior PR has merged and main has advanced. Under a git
worktree layout, `git checkout main` may fail if main is checked out in another worktree —
use `git -C <worktree-path> pull --ff-only` or switch worktrees explicitly.
**No CI:** `.github/workflows` is absent. Local gates are authoritative.
---
## Shared helpers
### Version-surface consistency check
Run after editing all three surfaces, **before** `npm run build`:
```bash
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
  const constants = fs.readFileSync('src/lib/constants.ts','utf8');
  const changelog = fs.readFileSync('CHANGELOG.md','utf8');
  const pkgVer = pkg.version;
  const appMatch = constants.match(/APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);
  const appVer = appMatch?.[1];
  const sections = changelog.split(/\n(?=## )/);
  const topSection = sections.find(s => /^## v/.test(s));
  const clMatch = topSection?.split('\n')[0].match(/^## (v[\d.]+)/);
  const clVer = clMatch?.[1];
  if (!appVer) { console.error('Could not parse APP_VERSION from constants.ts'); process.exit(1); }
  if (!clVer)  { console.error('Could not parse version from CHANGELOG.md top entry'); process.exit(1); }
  if (pkgVer !== appVer || appVer !== clVer.slice(1)) {
    console.error('VERSION MISMATCH:');
    console.error('  package.json:', pkgVer);
    console.error('  APP_VERSION: ', appVer);
    console.error('  CHANGELOG:   ', clVer);
    process.exit(1);
  }
  console.log('Version surfaces consistent:', pkgVer, '✓');
"
```
### CHANGELOG self-check (parameterized per PR)
Replace `TARGET_VERSION` with the version for that PR. Run **before** `npm run build`:
```bash
TARGET_VERSION="0.14.1"
node -e "
  const ver = process.argv[1];
  const content = require('fs').readFileSync('CHANGELOG.md','utf8');
  const sections = content.split(/\n(?=## )/);
  // Use trailing-space anchor to avoid matching v0.14.1 against v0.14.10
  const newEntry = sections.find(s =>
    s.startsWith('## v' + ver + ' ') ||
    s.startsWith('## v' + ver + '—') ||
    s.startsWith('## v' + ver + '–') ||
    s.startsWith('## v' + ver + '-')
  );
  if (!newEntry) { console.error('v' + ver + ' section not found in CHANGELOG'); process.exit(1); }
  const headerLine = newEntry.split('\n')[0];
  const match = headerLine.match(/^## (v[\d.]+)\s*[—–-]\s*(.+?)\s*\(([^)]+)\)$/);
  if (!match) { console.error('Header regex mismatch:', headerLine); process.exit(1); }
  const dateStr = match[3];
  if (!/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(dateStr)) {
    console.error('Date is not in expected format (Month D, YYYY). Partial placeholder?:', dateStr);
    process.exit(1);
  }
  const hasBullet = newEntry.split('\n').some(l => l.startsWith('- '));
  if (!hasBullet) { console.error('Entry has no bullet lines'); process.exit(1); }
  console.log('CHANGELOG OK: version=' + match[1] + ', date=' + dateStr);
" -- "$TARGET_VERSION"
```
### Override persistence check (run in every PR B–F after install)
```bash
node -e "
  const pkg  = JSON.parse(require('fs').readFileSync('package.json','utf8'));
  const lock = JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));
  const ov = pkg.overrides || {};
  const required = ['next','protobufjs','@grpc/grpc-js','vite'];
  const missing = required.filter(k => !ov[k]);
  if (missing.length) { console.error('MISSING overrides:', missing); process.exit(1); }
  const nested = lock.packages['node_modules/next/node_modules/postcss'];
  if (nested) {
    console.error('next/node_modules/postcss still present:', nested.version,
      '(override not applied)');
    process.exit(1);
  }
  console.log('Overrides intact. next/postcss deduped. ✓');
"
```
### iCloud build recovery (if `npm run build` fails with "cannot find native binding")
```bash
rm -rf node_modules && npm install
# Then retry the build. Do not proceed to the gate until the build is clean.
```
This can occur in any PR after `npm install` under iCloud eviction. PRs A and B are highest
risk (regen + native binding reinstall), but any PR can trigger it.
---
## Audit gate helpers
Baseline-diff logic catches fresh advisories. The `|| true` is required because even a
0-key baseline state regresses if a PR introduces a new advisory.
**Critical mechanics:**
- **Inline the helper in every gate call** — shell functions don't survive across Bash
  tool calls in the CC sandbox.
- On Node 22, `node -e '...' -- "PR-A" next` yields
  `process.argv = ["<node>", "PR-A", "next"]`. Use `[, pr, ...expected]` (one skip,
  label at argv[1]). `[,, pr, ...]` silently drops the first expected-cleared arg.
- Pass **package names** as expected-cleared args, never GHSA IDs.
- Run with network access (`dangerouslyDisableSandbox: true` in CC sandbox). A
  network/sandbox failure can produce valid JSON without a `.vulnerabilities` field or
  `metadata` — the shape guards catch this.
- The `expected[]` array in pre-flight Step 3 and the expected-cleared args in PR A's gate
  are the **same 12 package names** in different forms. They must be updated together if
  any advisory changes before branch-cut.
```bash
# PR A gate — clears all 12 keys:
npm audit --json > /tmp/audit-now.json || true
node -e "
  const [, pr, ...expected] = process.argv;
  let base, now;
  try { base = JSON.parse(require('fs').readFileSync('.audit-baseline.json','utf8')); }
  catch(e) { console.error('baseline unreadable:', e.message); process.exit(1); }
  try { now  = JSON.parse(require('fs').readFileSync('/tmp/audit-now.json','utf8')); }
  catch(e) { console.error('current audit unreadable (network? sandbox?):', e.message); process.exit(1); }
  if (!base.metadata || typeof base.metadata.vulnerabilities?.total !== 'number') {
    console.error('baseline is not a valid npm audit report — recapture from main post-PR-A');
    process.exit(1);
  }
  if (!now.metadata || typeof now.metadata.vulnerabilities?.total !== 'number') {
    console.error('current audit is not a valid npm audit report — possible network/registry error');
    process.exit(1);
  }
  const baseKeys = new Set(Object.keys(base.vulnerabilities || {}));
  const nowKeys  = new Set(Object.keys(now.vulnerabilities  || {}));
  const notInBase = expected.filter(k => !baseKeys.has(k));
  if (notInBase.length) { console.error('TYPO in expected-cleared args (not in baseline):', notInBase); process.exit(1); }
  const fresh = [...nowKeys].filter(k => !baseKeys.has(k));
  if (fresh.length) { console.error('FRESH advisories introduced:', fresh); process.exit(1); }
  for (const pkg of expected) {
    if (nowKeys.has(pkg)) { console.error('NOT CLEARED:', pkg); process.exit(1); }
    console.log('CLEARED:', pkg);
  }
  console.log(pr, 'audit gate PASSED');
" -- "PR-A" next postcss protobufjs "@grpc/grpc-js" "@protobufjs/utf8" \
     undici vite js-yaml "@babel/core" flatted picomatch brace-expansion
```
```bash
# PRs B–F — fresh-check only (post-regen baseline is 0 keys):
npm audit --json > /tmp/audit-now.json || true
node -e "
  const [, pr] = process.argv;
  let base, now;
  try { base = JSON.parse(require('fs').readFileSync('.audit-baseline.json','utf8')); }
  catch(e) { console.error('baseline unreadable:', e.message); process.exit(1); }
  try { now  = JSON.parse(require('fs').readFileSync('/tmp/audit-now.json','utf8')); }
  catch(e) { console.error('current audit unreadable (network? sandbox?):', e.message); process.exit(1); }
  if (!base.metadata || typeof base.metadata.vulnerabilities?.total !== 'number') {
    console.error('baseline is not a valid npm audit report — recapture from main post-PR-A');
    process.exit(1);
  }
  if (!now.metadata || typeof now.metadata.vulnerabilities?.total !== 'number') {
    console.error('current audit is not a valid npm audit report — possible network/registry error');
    process.exit(1);
  }
  const baseKeys = new Set(Object.keys(base.vulnerabilities || {}));
  const nowKeys  = new Set(Object.keys(now.vulnerabilities  || {}));
  const fresh = [...nowKeys].filter(k => !baseKeys.has(k));
  if (fresh.length) { console.error('FRESH advisories introduced:', fresh); process.exit(1); }
  console.log(pr, 'audit gate PASSED (fresh-check only)');
" -- "PR-B"
```
**After PR A:** update `.audit-baseline.json` to the post-regen 0-key state (Step 8).
PRs B–F use this baseline. If the baseline is ever lost, recapture with:
```bash
npm ci && npm audit --json > .audit-baseline.json || true
```
Recapture from `main` **after PR A has merged** — the v0.14.0 commit gives the 12-key
pre-regen baseline and defeats the fresh-check for cleared advisories.
---
## Pre-flight (one time, before PR A)
```bash
# 1. Confirm clean state
git log --oneline -3
git status   # must be clean
# 2. Ensure installed tree matches lockfile (fails loudly on mismatch)
npm ci
# 3. Capture audit baseline and verify exact key identity
npm audit --json > .audit-baseline.json || true
node -e "
  const a = JSON.parse(require('fs').readFileSync('.audit-baseline.json','utf8'));
  const keys = Object.keys(a.vulnerabilities || {}).sort();
  const expected = [
    '@babel/core','@grpc/grpc-js','@protobufjs/utf8',
    'brace-expansion','flatted','js-yaml',
    'next','picomatch','postcss','protobufjs','undici','vite'
  ].sort();
  console.log('Baseline keys:   ', keys.join(', '));
  console.log('Expected keys:   ', expected.join(', '));
  const match = JSON.stringify(keys) === JSON.stringify(expected);
  if (!match) {
    console.error('KEY MISMATCH — reconcile both the pre-flight expected[] array AND the');
    console.error('PR A audit gate args before proceeding; they must be the same 12 names.');
    process.exit(1);
  }
  console.log('Baseline matches expected 12 keys. ✓');
"
# If keys mismatch, update both the expected[] array above AND the PR A gate args
# (-- "PR-A" next postcss ...) to match the live advisory set before proceeding.
# 4. Add .audit-baseline.json to .gitignore (guard against duplicate)
grep -qxF '.audit-baseline.json' .gitignore || echo '.audit-baseline.json' >> .gitignore
git diff .gitignore
# 5. Confirm Vercel previews are enabled
echo "Confirm: Vercel project settings > Git > Preview Deployments are ON before PR A"
# 6. Record baseline anchor
git tag | grep "0\.14\.0" || echo "No v0.14.0 tag — baseline anchor: $(git log --oneline -1 | awk '{print $1}')"
# Never run git clean -fdx during the campaign — it deletes .audit-baseline.json
```
---
## PR A — Security regen + vitest 4.1.2 → 4.1.5
**Version bump:** 0.14.0 → 0.14.1
**CVEs cleared:** next advisory cluster (high, fix floor 16.2.6; target 16.2.9) · GHSA-qx2v-qp2m-jg93 (postcss, moderate)
**Cluster cleared:** protobufjs (critical CVSS 9.8) · @grpc/grpc-js (high) · @protobufjs/utf8 (moderate)
**Also cleared by regen:** undici (high) · vite (high) · js-yaml (moderate) · @babel/core (low) ·
  flatted (high) · picomatch (high+moderate) · brace-expansion (moderate)
**Soak bypass:** CVEs bypass the 60-day soak window. next@16.2.9 (13d) and postcss@8.5.15
  (35d) are soaking but taken as CVE fixes.
**vitest 4.1.5 (63d, soaked)** is folded in to eliminate the skew between vitest 4.1.2
  (pinned) and vite 8.1.0+ (floated by the `^8.0.16` override).
**Re-check at branch-cut:** Re-run `npm audit` before cutting this branch. The current binding
  floor is **next 16.2.6** (GHSA-26hh-7cqf-hhc6 and ~17 other high/moderate advisories in the
  cluster); target 16.2.9 clears it with margin. Do NOT anchor re-derivation to the moderate
  GHSA-ggv3-7p47-pfv8 (fixed in 16.1.7) — that is not why 16.2.9 is needed. If a new advisory
  now requires next above 16.2.9 or postcss above 8.5.15, update ALL of the following together:
  - Pre-pin table entries (`next`, `eslint-config-next`, `postcss`)
  - Overrides block: `"next": { "postcss": "<new-postcss-value>" }` if postcss target changes
  - Step 6 `exact()` assertions for next, eslint-config-next, postcss
  - CHANGELOG bullets and commit message
  Raise eslint-config-next alongside next (suite convention: same major.minor family).
**Deploy:** YES — next and firebase change the runtime artifact.
**Smoke:** Smoke the **Vercel preview deployment** before merging. After merge, run a brief
  **post-merge production smoke** (preview ≠ production env vars/rules): sign-in → load a
  cloud project → confirm a write persists.
**vitest/vite contingency:** If `npm test` breaks on the vitest 4.1.5 + vite 8.1.0+ pairing,
  temporarily narrow the override to `"vite": "8.0.3"` (pinning the installed version) and
  open a vitest follow-up once the root cause is diagnosed. The `vite` advisory key would
  then re-enter the baseline — document it explicitly before proceeding to PRs B–F.
### Why a regen is required
next@16.2.9 exact-pins `postcss: "8.4.31"` in its own `dependencies`. A plain install
preserves this nested copy; both the `postcss` and `next` advisory keys persist. An
`overrides` block redirects next's postcss resolution, but overrides are reified only by a
full lockfile regen. The firebase cluster (protobufjs CRITICAL, grpc-js HIGH) has the same
structure: vulnerable versions already satisfy parent ranges, so a plain install never floats
them to patched ceilings.
### Step 1 — Pre-pin all caret-ranged deps
Edit `package.json` to change every `^`/`~` specifier in `dependencies` and
`devDependencies` to exact. For deps upgraded in this PR, set to the target. For all others,
set to installed.
```json
"dependencies": {
  "@dnd-kit/core":      "6.3.1",
  "@dnd-kit/sortable":  "10.0.0",
  "@dnd-kit/utilities": "3.2.2",
  "date-fns":           "4.1.0",
  "firebase":           "12.12.1",
  "lucide-react":       "0.577.0",
  "nanoid":             "5.1.7",
  "next":               "16.2.9",
  "react":              "19.2.4",
  "react-dom":          "19.2.4",
  "recharts":           "3.8.1"
},
"devDependencies": {
  "@tailwindcss/postcss":      "4.2.2",
  "@testing-library/jest-dom": "6.9.1",
  "@testing-library/react":    "16.3.2",
  "@types/node":               "22.19.17",
  "@types/react":              "19.2.14",
  "@types/react-dom":          "19.2.3",
  "eslint":                    "9.39.4",
  "eslint-config-next":        "16.2.9",
  "jsdom":                     "28.1.0",
  "postcss":                   "8.5.15",
  "tailwindcss":               "4.2.2",
  "typescript":                "5.9.3",
  "vitest":                    "4.1.5"
}
```
Verify no carets or tildes remain in `dependencies`/`devDependencies` (runs before Step 2
adds the overrides block, which intentionally keeps ranges):
```bash
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
  const all = {...pkg.dependencies, ...pkg.devDependencies};
  const bad = Object.entries(all).filter(([,v]) => v.startsWith('^') || v.startsWith('~'));
  if (bad.length) { console.error('Remaining carets/tildes in deps:', bad); process.exit(1); }
  console.log('All', Object.keys(all).length, 'direct deps are exact-pinned. ✓');
"
```
### Step 2 — Add the overrides block
Add at the top level of `package.json`:
```json
"overrides": {
  "next": { "postcss": "8.5.15" },
  "protobufjs":    "^7.6.3",
  "@grpc/grpc-js": "~1.9.16",
  "vite":          "^8.0.16"
}
```
Notes:
- `next → postcss: "8.5.15"` is exact. A range would risk floating next's nested copy to a
  different version from the root dep, leaving two un-deduped copies.
- `protobufjs ^7.6.3` and `@grpc/grpc-js ~1.9.16` are range floors: they prevent regression
  on future installs after the regen clears the cluster.
- `vite ^8.0.16` floors vite at the CVE fix via vitest's peer range.
- Never use `"$variable"` syntax — npm silently drops `$`-refs.
### Step 3 — Edit version surfaces and run checks
- `package.json` `"version"`: `"0.14.1"`
- `src/lib/constants.ts`: `APP_VERSION = '0.14.1'`
- `CHANGELOG.md`: add new top entry (see Step 9 for full text)
Run the **version-surface consistency check** (shared section above).
Run the **CHANGELOG self-check** with `TARGET_VERSION="0.14.1"`.
### Step 4 — Full lockfile regen
```bash
rm package-lock.json
rm -rf node_modules
npm install
```
### Step 5 — iCloud hydration probe (mandatory before formal gate)
```bash
rm -rf .next
npm run build
```
If this fails with "cannot find native binding" or module-not-found, use the shared iCloud
recovery above. This probe does not count as the formal gate.
**ESLint note:** Next 16 does not run ESLint during `next build` (no `next lint` CLI module
in `node_modules/next/dist`, no eslint peer). `npm run lint` runs as part of the formal gate
(Step 7), covering the eslint-config-next 16.1.6→16.2.9 bump. `@typescript-eslint` (pulled by
eslint-config-next) may warn about an unsupported TypeScript major — non-fatal (a warning,
not a lint error).
### Step 6 — Lockfile verification
Step 6 is **diagnostic only** — the Step 7 audit gate is authoritative. A Step 6 `✗` is a
signal to investigate, not an automatic reason to tear down and re-regen. Verify at
branch-cut that all floor-version targets below exist on the registry (re-derive from
`npm audit --json` fix fields rather than from this plan's version numbers, which reflect
today's registry state and may have advanced).
```bash
node -e "
const l = JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));
const exact = (pkg, ver) => {
  const v = l.packages['node_modules/' + pkg]?.version;
  const ok = v === ver;
  console.log((ok ? '✓' : '✗'), pkg + ':', v || 'MISSING',
    ok ? '' : '(expected exactly ' + ver + ')');
};
const floor = (pkg, fixFloor) => {
  const entry = l.packages['node_modules/' + pkg];
  if (!entry) { console.log('✗', pkg + ': MISSING (expected ≥' + fixFloor + ')'); return; }
  const v = entry.version;
  const ge = (a, b) => {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    if (pa.some(isNaN) || pb.some(isNaN)) return true; // prerelease: skip, audit gate covers it
    for (let i = 0; i < 3; i++) { if (pa[i] > pb[i]) return true; if (pa[i] < pb[i]) return false; }
    return true;
  };
  const ok = ge(v, fixFloor);
  console.log((ok ? '✓' : '✗'), pkg + ':', v,
    ok ? '>=' + fixFloor : '(below advisory fix floor ' + fixFloor + ')');
};
// Directly exact-pinned deps
exact('postcss',            '8.5.15');
exact('next',               '16.2.9');
exact('eslint-config-next', '16.2.9');
exact('firebase',           '12.12.1');
exact('vitest',             '4.1.5');
// Range-overridden deps — floor at advisory fix version (not today's registry ceiling)
floor('protobufjs',        '7.6.3');   // override ^7.6.3; advisory fixed in 7.6.3
floor('@grpc/grpc-js',     '1.9.16');  // override ~1.9.16; advisory fixed in 1.9.16
floor('vite',              '8.0.16');  // override ^8.0.16; advisory fixed in 8.0.16
// Floated by regen — floor at advisory fix version
floor('@protobufjs/utf8',  '1.1.1');   // advisory <=1.1.0; protobufjs 7.6.3 deps ^1.1.1 -> 1.1.1
floor('undici',            '7.28.0');  // advisory <7.28.0 (highest fix floor across all undici advisories)
floor('js-yaml',           '4.1.2');   // advisory <=4.1.1; fix 4.1.2
floor('@babel/core',       '7.29.1');  // advisory <=7.29.0; fix 7.29.1
floor('flatted',           '3.4.2');   // advisory <=3.4.1; fix 3.4.2
// Verify next's nested postcss was deduped (nested copy must be absent)
const nextPostcss = l.packages['node_modules/next/node_modules/postcss'];
if (nextPostcss) {
  console.log('✗ next/node_modules/postcss:', nextPostcss.version,
    '(override not applied — nested copy must be absent)');
} else {
  console.log('✓ next/node_modules/postcss: absent (deduped to root ✓)');
}
// Verify picomatch: all copies at or above their advisory fix floors
// 2.x advisory: <2.3.2 (fixed 2.3.2) | 4.x advisory: 4.0.0–4.0.3 (fixed 4.0.4)
const allPico = Object.entries(l.packages)
  .filter(([k]) => k.endsWith('/picomatch') || k === 'node_modules/picomatch')
  .map(([k, v]) => ({ path: k.replace('node_modules/',''), version: v.version }));
const vulnPico = allPico.filter(e => {
  const [mj, mn, pt] = e.version.split('.').map(Number);
  if (mj === 2) return mn < 3 || (mn === 3 && pt < 2); // <2.3.2
  if (mj === 4) return mn === 0 && pt < 4;             // <4.0.4 (advisory 4.0.0–4.0.3, fixed 4.0.4)
  return false;
});
if (vulnPico.length) {
  console.log('✗ picomatch: vulnerable copies remain:', JSON.stringify(vulnPico));
} else {
  console.log('✓ picomatch: all copies patched', allPico.map(e => e.path + '@' + e.version).join(', '));
}
// Verify brace-expansion: no copy in vulnerable range
// 1.x advisory: <1.1.13 | 4.x advisory: >=4.0.0 <5.0.5 (both 4.x versions vulnerable, no 4.x fix)
// 5.x advisory: <5.0.6
const allBE = Object.entries(l.packages)
  .filter(([k]) => k.endsWith('/brace-expansion') || k === 'node_modules/brace-expansion')
  .map(([k, v]) => ({ path: k.replace('node_modules/',''), version: v.version }));
const vulnBE = allBE.filter(e => {
  const [mj, mn, pt] = e.version.split('.').map(Number);
  if (mj === 1) return mn < 1 || (mn === 1 && pt < 13);  // <1.1.13
  if (mj === 4) return true;                               // all 4.x vulnerable (fix requires 5.x)
  if (mj === 5) return pt < 6;                            // <5.0.6
  return false;
});
if (vulnBE.length) {
  console.log('✗ brace-expansion: vulnerable copies remain:', JSON.stringify(vulnBE));
} else {
  console.log('✓ brace-expansion: all copies patched', allBE.map(e => e.version).join(', '));
}
// Verify react-is resolved to 19.x (peer dep via recharts 3)
const ri = l.packages['node_modules/react-is'];
const riOk = ri && ri.version.startsWith('19.');
console.log(riOk ? '✓' : '?', 'react-is:', ri?.version || 'NOT FOUND',
  riOk ? '' : '(expected 19.x)');
// Verify overrides block persisted
const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
const ov = pkg.overrides || {};
const requiredOv = ['next','protobufjs','@grpc/grpc-js','vite'];
const missingOv = requiredOv.filter(k => !ov[k]);
console.log(missingOv.length === 0 ? '✓' : '✗', 'overrides block:',
  missingOv.length === 0 ? 'all keys present' : 'MISSING: ' + missingOv.join(', '));
"
```
### Step 7 — Formal gate
```bash
rm -rf .next && npm run build && npm run lint && npm test
```
Then the PR A audit gate (inline the full helper from the shared section, substituting the
PR label `"PR-A"` and the 12 expected-cleared args as shown in the shared template).
Expected: all 12 keys cleared, `npm audit` exits 0. Health: **12 → 0**.
### Step 8 — Update .audit-baseline.json
```bash
npm audit --json > .audit-baseline.json || true
node -e "
  let a;
  try { a = JSON.parse(require('fs').readFileSync('.audit-baseline.json','utf8')); }
  catch(e) { console.error('baseline unreadable:', e.message); process.exit(1); }
  if (!a.metadata || typeof a.metadata.vulnerabilities?.total !== 'number') {
    console.error('baseline is not a valid npm audit report — possible network error; retry');
    process.exit(1);
  }
  const keys = Object.keys(a.vulnerabilities || {});
  if (keys.length !== 0) {
    console.error('Expected 0 keys after regen; found:', keys.join(', '));
    console.error('Investigate before proceeding to PR B.');
    process.exit(1);
  }
  console.log('Post-regen baseline: 0 advisory keys. ✓');
"
```
### Step 9 — CHANGELOG entry
Every bullet is a single physical line. Replace `Month DD, YYYY` with the actual date.
Run the CHANGELOG self-check with `TARGET_VERSION="0.14.1"`.
```markdown
## v0.14.1 — Security: dependency regen (Month DD, YYYY)
Clears all 12 transitive advisory keys via full lockfile regen with targeted overrides.
The `next→postcss` override (exact `8.5.15`) dedupes next's pinned `postcss 8.4.31`,
clearing both the postcss and next advisory keys. The regen floats the firebase/Firestore
subtree to patched ceilings, clearing protobufjs (critical CVSS 9.8), @grpc/grpc-js (high),
and @protobufjs/utf8 (moderate). The regen also floats undici (high via jsdom), vite (high
via vitest), js-yaml (moderate), @babel/core (low), flatted (high), picomatch (high+moderate),
and brace-expansion (moderate) to their patched ceilings within existing parent ranges.
Also upgrades vitest 4.1.2→4.1.5 to align with the floated vite 8.1.0+ in the same regen.
### Fixed
- Security: next 16.1.6→16.2.9 (high-severity advisory cluster, fix floor 16.2.6; 18 advisories cleared). (security)
- Security: postcss 8.5.8→8.5.15 with `next→postcss` override clearing next-bundled 8.4.31 (CVE GHSA-qx2v-qp2m-jg93, moderate). (security)
- Security: protobufjs CVSS 9.8 cluster cleared via regen (protobufjs, @grpc/grpc-js high, @protobufjs/utf8 moderate — all via firebase/Firestore subtree). (security)
- Security: undici, vite, js-yaml, @babel/core, flatted, picomatch, brace-expansion cleared via regen to patched ceilings. (security)
### Changed
- Dependency: firebase 12.11.0→12.12.1 (SoakEligible, 63d). (deps)
- Dependency: eslint-config-next 16.1.6→16.2.9 (coupled to next). (deps)
- Dependency: vitest 4.1.2→4.1.5 (SoakEligible, 63d; folded into regen to align with floated vite). (deps)
```
Commit:
```bash
git checkout -b pr-a-security-regen
git add package.json package-lock.json src/lib/constants.ts CHANGELOG.md .gitignore docs/upgrade/dependency-upgrade-plan-v5.md
git commit -m "v0.14.1: security regen — next CVE cluster, postcss CVE, protobufjs critical cluster"
git push -u origin pr-a-security-regen
```
**Pre-merge smoke (Vercel preview):** sign-in → load cloud project → make an edit → verify
Firestore write persists → navigate all tabs → CFD chart renders on a project with snapshot
data → load `/changelog` → confirm v0.14.1 entry renders with correct date.
**Post-merge smoke (production):** sign-in → load a cloud project → confirm a write persists.
**After merge:** `git checkout main && git pull --ff-only`
---
## PR B — tailwindcss 4.2.2 → 4.2.4 + @tailwindcss/postcss 4.2.2 → 4.2.4
**Version bump:** 0.14.1 → 0.14.2
**Soak math (re-derive at branch-cut):**
- tailwindcss 4.2.4: pub 2026-04-21 (63d) · SOAKED · next above: 4.3.0 clears ~2026-07-07
- @tailwindcss/postcss 4.2.4: same dates as tailwindcss
**Coupling:** `@tailwindcss/postcss` exact-pins `tailwindcss` in its own `dependencies`
block. Both must move to the same version atomically. After install, verify no stale nested
tailwindcss copy survived:
```bash
node -e "
  const l = JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));
  const copies = Object.entries(l.packages)
    .filter(([k]) => k.endsWith('/tailwindcss') || k === 'node_modules/tailwindcss')
    .map(([k,v]) => k + '@' + v.version);
  console.log('tailwindcss copies:', copies.join(', '));
  const stale = copies.filter(c => !c.includes('4.2.4'));
  if (stale.length) { console.error('Stale copies:', stale); process.exit(1); }
  console.log('All tailwindcss copies at 4.2.4 ✓');
"
```
**Install method:** Edit exact specifiers, then `npm install`.
**Override persistence check:** Run after install.
**Version surfaces:** Edit all three, then run consistency check and CHANGELOG self-check
(`TARGET_VERSION="0.14.2"`).
**Gate:** `rm -rf .next && npm run build && npm run lint && npm test` then fresh-check audit gate (`"PR-B"`).
**Smoke:**
- Tier 2: CSS visual scan (tailwindcss changes the shipped CSS artifact)
- Per-PR: load `/changelog` → confirm v0.14.2 entry renders with correct date
**Deploy:** YES — tailwindcss is a CSS engine; the shipped CSS bundle changes.
**After merge:** `git checkout main && git pull --ff-only`
---
## PR C — TypeScript 5.9.3 → 6.0.3
**Version bump:** 0.14.2 → 0.14.3
**Soak math:** typescript 6.0.3: pub 2026-04-16 (67d) · SOAKED · no 6.1.0 yet.
**Major approved.**
**Install method:** Edit exact specifier, then `npm install`.
**TS6 risk:** The 15 `useRef<T>(null)` sites compile correctly under `@types/react@19.2.14`.
RefObject nullability is owned by `@types/react@19` (already adopted). Expect zero edits.
Trust the build — fix any site it flags; proceed if clean.
`npm run lint` runs in the formal gate. `@typescript-eslint` may warn about an unsupported
TypeScript major — non-fatal (a warning, not a lint error).
**Deploy note:** Next.js uses SWC (not tsc) to produce the shipped JS bundle. tsc
type-checks only. A tsc version bump does not change the shipped runtime artifact.
**Override persistence check:** Run after install.
**Version surfaces:** Edit all three, then run consistency check and CHANGELOG self-check
(`TARGET_VERSION="0.14.3"`).
**Gate:** `rm -rf .next && npm run build && npm run lint && npm test` then fresh-check audit gate (`"PR-C"`).
**Smoke:**
- Tier 0: build gate is sufficient (no runtime change)
- Per-PR: load `/changelog` → confirm v0.14.3 renders
**Deploy:** NO (SWC output unchanged; Vercel still builds on merge).
**After merge:** `git checkout main && git pull --ff-only`
---
## PR D — nanoid 5.1.7 → 5.1.9 + lucide-react 0.577.0 → 1.11.0
**Version bump:** 0.14.3 → 0.14.4
**Soak math (re-derive at branch-cut — URGENT, both have imminent expiry):**
- nanoid 5.1.9: pub 2026-04-15 (69d) · SOAKED · next above (5.1.10) clears ~2026-06-29 (6 days)
- lucide-react 1.11.0: pub 2026-04-24 (60d) · SOAKED · next above (1.12.0) clears ~2026-06-27 (4 days)
Both targets are likely superseded by execution time. Re-derive at branch-cut and update
all version references in the CHANGELOG bullet and commit message to match the actual target.
**Major approved:** lucide-react 0.x → 1.x. Only breaking change: brand icon removal.
CFD uses 12 icons — none are brand icons. Verify:
```bash
grep -rn "from 'lucide-react'" src/
```
Zero code changes expected. Trust the build.
**Override persistence check:** Run after install.
**Version surfaces:** Edit all three, then run consistency check and CHANGELOG self-check
with the correct `TARGET_VERSION`.
**Gate:** `rm -rf .next && npm run build && npm run lint && npm test` then fresh-check audit gate (`"PR-D"`).
**Smoke (Tier 3, human-run):**
- Visual icon scan: X (close buttons), Trash2 (workflow state rows, project rows, and
  grid-table.tsx cell delete), AlertTriangle (metrics panel), Check (color picker),
  ChevronUp/ChevronDown (workflow state rows), Pencil (workflow editor), Plus (add state,
  grid toolbar), Eye (workflow editor), Download/Upload (grid toolbar), ArrowUpDown (sort)
- Per-PR: load `/changelog` → confirm entry renders with correct date
**Deploy:** YES — lucide-react ships in the JS bundle.
**After merge:** `git checkout main && git pull --ff-only`
---
## PR E — react 19.2.4 → 19.2.5 + react-dom 19.2.4 → 19.2.5
**Version bump:** 0.14.4 → 0.14.5
**Soak math (re-derive at branch-cut):**
- react/react-dom 19.2.5: pub 2026-04-08 (75d) · SOAKED · next above (19.2.6) clears ~2026-07-05
**@types/react:** Pinned at installed 19.2.14. Next candidate 19.2.17 is deferred (soaking
17/60d at plan-writing). Do NOT bump in this PR. `@types/react-dom` peer-requires
`@types/react ^19.2.0`; installed 19.2.14 satisfies this.
**react-is:** Peer-only at 19.2.4 via recharts 3. Do NOT add as a direct dep.
**Override persistence check:** Run after install.
**Version surfaces:** Edit all three, then run consistency check and CHANGELOG self-check
(`TARGET_VERSION="0.14.5"`).
**Gate:** `rm -rf .next && npm run build && npm run lint && npm test` then fresh-check audit gate (`"PR-E"`).
**Smoke (Tier 3, human-run):**
- General UI: render the app, interact with a project, create and edit a workflow state
- Per-PR: load `/changelog` → confirm v0.14.5 renders
**Deploy:** YES — react is a runtime dep.
**After merge:** `git checkout main && git pull --ff-only`
---
## PR F — jsdom 28.1.0 → 29.0.2
**Version bump:** 0.14.5 → 0.14.6
**Soak math (re-derive at branch-cut — URGENT):**
- jsdom 29.0.2: pub 2026-04-07 (77d) · SOAKED
- jsdom 29.1.0: pub 2026-04-27 (57d) · clears ~2026-06-26 (3 days from plan-writing)
- jsdom 29.1.1: pub 2026-04-30 (54d) · clears ~2026-06-29
Re-derive — 29.1.x will almost certainly have cleared by execution time. Update version
references in the CHANGELOG and commit message when re-deriving.
**Major approved.** Precedent: jsdom 29 already applied in WE-3 (spert-ahp).
**undici:** PR A's regen floated undici to 7.28.0+ (jsdom 28's `^7.21.0` ceiling). jsdom 29
re-floors the range at `^7.24.5`. The undici advisory fix floor is 7.28.0; `^7.24.5` admits
versions below that threshold, so structural durability depends on npm resolving to the
latest 7.x (currently well above 7.28.0). The PR F fresh-check audit gate confirms undici
remains clear — that is the authoritative check, not the jsdom range.
**Test scope:** 8 of 29 test files use `// @vitest-environment jsdom`. The gate exercises
all 29; the 8 jsdom-pragma files are the effective smoke for this upgrade.
**Override persistence check:** Run after install.
**Version surfaces:** Edit all three, then run consistency check and CHANGELOG self-check
(`TARGET_VERSION="0.14.6"`).
**Gate:** `rm -rf .next && npm run build && npm run lint && npm test` then fresh-check audit gate (`"PR-F"`).
**Smoke:**
- Tier 1: test gate runs the 8 jsdom-pragma files under jsdom 29. Gate is sufficient.
- Per-PR: load `/changelog` → confirm v0.14.6 renders
**Deploy:** NO — jsdom is test-environment only.
**After merge:** `git checkout main && git pull --ff-only`
---
## Firm campaign end state: v0.14.6 · Advisory health: 0 keys throughout
---
## Conditional follow-ups (not numbered campaign PRs)
### recharts 3.8.1 → 3.9.0 (execute ~2026-08-22)
recharts 3.9.0 published 2026-06-23 (0d). Clears ~2026-08-22. Re-derive target at execution.
No formatter migration needed (`src/components/chart/cfd-chart.tsx` already on recharts 3 API).
The `<Brush>` control renders only when `data.length > 14`. The first-visit sample seeds
exactly 14 snapshots — AreaChart, tooltip, and legend are self-sufficient. To smoke the Brush,
add ≥1 snapshot manually (15 total) before testing.
react-is peer dep already at 19.2.4. Plain install, no regen.
Run override persistence check. Fresh-check audit gate.
### @types/react → highest soaked version (execute ~2026-08-04)
@types/react 19.2.17 published 2026-06-05 (17/60d). Clears ~2026-08-04. Re-derive at execution.
`@types/react-dom` peer-requires `^19.2.0`; installed 19.2.14 satisfies this.
Plain install, no-deploy. Fresh-check audit gate.
### vitest ceiling (if a higher version soaks before campaign end)
vitest 4.1.9 (pub 2026-06-15) clears ~2026-08-14. Plain install. No-deploy.
---
## Health trajectory
| After | Advisory keys | Notes |
|---|---|---|
| Baseline (v0.14.0) | 12 (1 crit, 6 high, 4 mod, 1 low) | |
| PR A | **0** | regen: 12 → 0; `npm audit` exits 0 |
| PR B | 0 | tailwind currency |
| PR C | 0 | TS6 |
| PR D | 0 | nanoid/lucide |
| PR E | 0 | react patch |
| PR F | 0 | jsdom 29 |
| Follow-ups | 0 | recharts, @types/react, vitest ceiling |
---
## Dependency coupling reference
| Coupling | Mechanism |
|---|---|
| next ↔ eslint-config-next | suite convention: same major.minor family; raise both together if next CVE requires higher target |
| react ↔ react-dom | peer deps; move atomically |
| @types/react-dom ↔ @types/react | peer-requires ^19.2.0 |
| @tailwindcss/postcss ↔ tailwindcss | @tailwindcss/postcss exact-pins tailwindcss; move atomically |
| recharts ↔ react-is | recharts 3 peer-requires react-is; peer-only at 19.2.4 |
| vitest ↔ jsdom | peer; 8 test files use jsdom pragma |
| next → postcss | next exact-pins 8.4.31; clearable only via override + regen |
| firebase → @firebase/firestore → grpc/protobufjs | regular deps; cleared by regen + overrides |
| jsdom → undici | jsdom 28: ^7.21.0 / jsdom 29: ^7.24.5; undici cleared by regen in PR A |
| vitest → vite | peer ^6‖^7‖^8; vite 8.1.0+ floated by regen; ^8.0.16 override floors it |
| eslint → brace-expansion (1.x) | minimatch 3.x uses ^1.1.7, floats to 1.1.15 (≥1.1.13 fix); cleared by regen |
---
## Deferred items
- eslint 9→10 (major; no other SPERT app on eslint 10 yet)
- @types/node 25.x / 26.x (Node pinned at 22.x; December upgrade planned)
- date-fns 4.4.0 (soaking at plan-writing)
- @types/react 19.2.17 (soaking; see follow-ups)
- vite 8 as a first-class direct dep (currently transitive via vitest only)
---
## Not in this plan
- Any new features or bug fixes
- Changes to Firestore rules or Cloud Functions
- spert-devops dashboard suppression work
- Any upgrade to eslint 10, @types/node 25+, or any other explicitly deferred major
---
## Applied review fixes (v5, 2026-06-23)
The following corrections were applied to this plan before execution, verified against the
live `npm audit` advisory DB and the installed tree:
1. **Lint in the gate** — `npm run lint` added to the formal gate for every PR
   (`rm -rf .next && npm run build && npm run lint && npm test`). Confirmed `next build` does
   not run ESLint in Next 16 (no `next-lint` CLI module; no eslint dep/peer), and the repo
   has no CI, so lint must be an explicit gate step.
2. **next advisory attribution** — the binding floor is `next 16.2.6` (GHSA-26hh-7cqf-hhc6
   plus ~17 other high/moderate cluster advisories), not the moderate GHSA-ggv3-7p47-pfv8
   (fixed in 16.1.7). Target 16.2.9 clears the cluster with margin. Corrected in the PR A
   header, the re-check note, and the CHANGELOG bullet.
3. **picomatch Step 6 predicate** — the 4.x advisory is `4.0.0–4.0.3`, fixed in `4.0.4`
   (not "all 4.x / fix requires 5.x"). Predicate corrected to `mn === 0 && pt < 4`.
4. **useRef count** — PR C note corrected from 10 to 15 `useRef<T>(null)` sites (actual count
   in `src/`).
