# Mutation baseline — v0.15.7 (2026-08-23)

First mutation run. **This is a baseline, not a gate.** `npm run mutate` is deliberately not a
shipgate step and `thresholds.break` is `null`: a measurement must not be able to fail a release.

```
total mutants   1187        wall clock 5m38s (~0.285 s/mutant, concurrency 4)
Killed           604        Survived   180        CompileError  349
NoCoverage        47        Timeout      7        RuntimeError    0        Ignored 0
mutation score  72.91%      (covered 77.24%)
```

⚠️ **`Timeout` counts on the KILLED side of the score.** Seven of the 611 on that side are timeouts,
not kills. With `maxTestRunnerReuse` absent and runner startup paid per mutant, a slower machine
raises that number and the score with it. Compare status counts, never the score alone.

⚠️ **And the score is a poor proxy for value.** Measured at Story Map: one `toEqual` on a palette
table killed 31 survivors for +1.86pp, while ten compile-time guards removed 32 survivors for
+0.15pp. A reader optimising the score would write the assertion and skip the guards, which is
backwards.

## Scope — six files, 395 branches

Selected by the item-03 candidacy gate: pure logic (no react/next import), ≥10 branches, ≥70% branch
coverage, **and** a survivor would change what we do.

| file | branches | survivors | CompileError | NoCoverage |
|---|---|---|---|---|
| `storage.ts` | 153 | **104** | 118 | 26 |
| `import-utils.ts` | 113 | 26 | 112 | 5 |
| `csv.ts` | 41 | 25 | 25 | 6 |
| `migrations.ts` | 18 | 17 | 29 | 10 |
| `calculations.ts` | 25 | 7 | 31 | 0 |
| `invitation-errors.ts` | 45 | **1** | 34 | 0 |

**Excluded and why:** `firestore-driver.ts` (27.36% br), `user-display.ts` (42.85%), `firebase.ts`,
`consent.ts` — below the coverage floor, where mutation only rediscovers what coverage already says.
The React hooks (`use-grid-navigation`, `use-workflow-editor`, `use-dismiss`, `use-member-profiles`,
`invite-capture`) fail the pure-logic question, not the coverage one.

⚠️ **`import-utils.ts` was nearly excluded by a blanket category label** — item 03's Q5 declined seven
files as "cloud plumbing" without checking that label against the file. It is import conflict
resolution and project merging, data-destructive if wrong. Under-scoping by unchecked category is the
same shape as every unstated criterion this campaign has hit.

## Survivors by mutator

```
94  ConditionalExpression    13  MethodExpression      2  OptionalChaining
22  EqualityOperator          7  BlockStatement        2  ArrowFunction
18  StringLiteral             5  Regex                 1  ArithmeticOperator
15  LogicalOperator                                     1  UnaryOperator
```

`excludedMutations` is **empty, deliberately**. The suite disagrees — the Vite siblings exclude
`StringLiteral`/`ObjectLiteral`. A first baseline should see the full population; excluding shrinks a
denominator before anyone knows what is in it. At 18 of 180, `StringLiteral` is not the dominant
cluster here, so there is no case for excluding it yet.

## The pre-registered control — satisfied, and it corrected its own prediction

Item 04 proved **by hand** that `detectWipViolations`'s `?? 0` (`calculations.ts:125`) is
*unobservable*: fully covered, and removing it breaks no test. An unobservable guard is exactly what
a survivor is, so the run had to reproduce it — in two steps, because step 2 alone presumes a mutant
is generated there at all.

**Step 1 — a mutant exists at L125:** four of them.
**Step 2 — one survives:** ✔

```
ConditionalExpression   Killed     "true"
EqualityOperator        SURVIVED   (counts[state.id] ?? 0) >= state.wipLimit
EqualityOperator        Killed     (counts[state.id] ?? 0) <= state.wipLimit
LogicalOperator         Killed     counts[state.id] && 0
```

⚠️ **The survivor is not the mutant that was predicted, and the difference is the finding.** The
`??` mutation itself is **killed** — `counts[id] && 0` returns `0` for a *present* count, so a state
genuinely over its limit stops being reported and an existing test catches it. The hand-removal test
used the *missing-key* case; Stryker's mutant is caught by the *present-key* case. The actual
survivor is `>` → `>=`: **no test asserts that a count exactly equal to its WIP limit is not a
violation.** A real boundary gap, found only because the control was run in two steps.

For contrast, the three sites item 04 falsified as load-bearing came back with **zero survivors**:
`L55` 3 mutants, `L91` 3, `L105` 5. The run independently reproduced the hand result on three of four
sites and disagreed instructively on the fourth.

## Q4 scales — predictions against measurement

**cross-system — held.** The canonical `firestore.rules` expresses only `spertCfdProjectFields()`,
twelve top-level key names via `keys().hasOnly()`, and only in cloud mode. It states no value type,
regex, enum or length, so `validateProjectData`'s substantive checks have no independent expression
anywhere. In local-storage mode there is no server at all. Its 104 survivors are overwhelmingly real
GAP rather than redundancy.

**cross-layer — PREDICTION FAILED, and the reasoning error is the useful part.** Predicted:
CompileError would cluster in `csv`/`migrations`/`import-utils` and be *near-absent* in
`validateProjectData`, because that function takes `unknown` so the type system buys nothing.
Measured: CompileError is **31.2% inside `validateProjectData` against 29.1% for the whole file** —
slightly *higher*, not near-absent. The error: mutants do not land on the function's *signature*,
they land on its *body*, and the body's `typeof` guards, `Number.isFinite` calls and string literals
are fully typed. Reasoning about a signature and reporting about a body.

**intra-function — held in outcome, with an interaction worth recording.** Brief 03 named
`storage.ts:168` as a predicted EQUIV site: `typeof s.wipLimit !== 'number'` is implied by
`!Number.isFinite(...)`, which does not coerce. That line produced **three survivors**, including
`s.wipLimit <= 0` → `s.wipLimit < 0` — no test uses `wipLimit === 0`, a second boundary gap on the
same field as the control's.

⚠️ **But the specific mutant that would have proved the predicted redundancy came back
`CompileError`, not `EQUIV`.** The typescript-checker rejects it before the suite ever runs, so a
redundancy identifiable by reading cannot appear as EQUIV in the report. **The cross-layer scale
masks the intra-function scale.** That is GanttApp's "EQUIV is a property of position, not of the
guard" in a new form, and it means the survivor set understates intra-function redundancy by an
unknown amount.

## Vacuity — what was falsified, and what could not be

| arm | result |
|---|---|
| 1 · no report written | ✔ provoked (bad `testRunner`) — guard: *"treat this as NO RESULT, not as zero survivors"* |
| 2 · zero mutants | ⚠️ **not independently provokable** — see below |
| 2a · partial scope | ✔ falsified against a stale single-file report (reported 5 missing), then passed on the real one: 6 expected, 6 present, exact match |
| 3 · stale report | ✔ guard `rmSync`s before running (`mutation-guard.mjs:45`); demonstrated operationally in arm 1, where a prior successful report was deleted and correctly reported absent |
| 4 · every mutant NoCoverage | ⚠️ **not provokable, and would not be caught** — see below |
| 5 · positive control | ✔ a real survivor, in the scoped run and the full one |

⚠️ **Arms 2 and 4 both collapse into arm 1 in this repo.** Every route tried — a `mutate` glob
matching a zero-statement file, and a `vitest.configFile` whose `include` matches no tests — makes
Stryker exit **before writing a report**, so the no-report check catches it and the specific arm
never fires. That is precisely the GanttApp failure the method warns about, reproduced here.

Their guard logic was therefore verified against **synthetic reports** instead, which is a weaker
claim and is labelled as one: zero-mutants → correctly fails; all-`CompileError` → correctly fails.

⚠️ **All-`NoCoverage` PASSES the guard**, and that is a real gap. `mutation-guard.mjs` computes
`executed = killed + survived + timeout + noCoverage` and only fails when that is zero — with an
explicit comment calling `NoCoverage` "a real verdict." A run where every mutant is `NoCoverage`
would print score `0.00%` and *"the run produced real verdicts."* Reported here, not patched: the
file is a byte-identical three-repo shared artifact and a local edit forks it.

⚠️ **Arm 4's stated cause does not apply here either.** Omitting `vitest.configFile` changed nothing
— identical 109 mutants, 0 NoCoverage, same score — because `vitest.config.ts` sits at the *default*
path and the runner discovers it regardless. The sibling claim assumes a non-default filename.

## Exclusion sites — two, not three

`.stryker-tmp` must be excluded from **ESLint** (done in v0.15.5, and load-bearing now that
`expectProblems: 10` is live) and from **git** (added here — the repo is public and the sandbox holds
full copies of mutated source).

It does **not** need a vitest exclude: `test.include` is anchored `src/**/*.test.ts`, so minimatch
cannot match `.stryker-tmp/sandbox-N/src/**`. It does **not** need a tsconfig exclude either, despite
an unanchored `**/*.ts` include — **measured: `tsc --noEmit` exits 0 with a deliberately broken file
under `.stryker-tmp/`, because TypeScript's wildcard globs skip dot-directories.** That resolves a
standing disagreement between two sibling close-outs, one claiming three sites and one two.

⚠️ **The asymmetry is worth keeping: `.stryker-tmp` is protected by its leading dot for free.
`reports/` is not — it escapes `**/*.ts` only because it happens to contain no TypeScript.**

**Verified after the run:** lint still reads exactly **10** with both directories on disk.
