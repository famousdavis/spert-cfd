<!-- Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
     Licensed under the GNU General Public License v3.0.
     See LICENSE file in the project root for full license text. -->

# SPERT CFD — Import Spec Deviations

Documents deliberate departures from the Level 4 import spec
(`IMPORT-SPEC-REFERENCE.md` in the robust-import-guide). Each entry: which
pattern, behavioral consequence, mitigation, and target version for full
compliance.

---

## Deviation 1 — `driverLoading` instead of `cloudDataLoaded` reference pattern

**Spec pattern:** Separate `cloudDataLoaded` signal confirmed at all
cloud-write sites (refs. Scheduler v0.43.0, MyScrumBudget v0.30.0).

**CFD implementation:** `driverLoading: boolean` in `ProjectListContext`.
Set true when `useEffect([driver])` starts in cloud mode; cleared to false
when `loadProjectList()` resolves successfully. On cloud-mode rejection,
`driverLoading` stays true until:

- The `onProjectListChange` subscription fires with a non-empty list
  (auto-recovery), or
- The user signs out and back in (new driver cycle), or
- The page is refreshed.

**Behavioral consequence:** Firestore's `getDocs()` uses the SDK's default
source policy: server when online, local cache when offline.
`driverLoading=false` signals "first read complete" rather than "confirmed
authoritative server data."

The user-facing mitigation (C1) is the cloud-hydration hint in
`ImportPreviewSection`, appearing when
`mode === 'cloud' && existingCount === 0 && incoming.length > 0`. This
correctly targets the scenario where Firestore cached an empty result. The
`onProjectListChange` subscription reconciles the project list when
connectivity returns.

**Initial commit risk:** The first import Confirm during an offline window
(where `driverLoading` erroneously flipped to false due to an empty cache
result) completes against the cached snapshot. Writes go to Firestore and
may create duplicates on reconnection. The Layer 1 drift check protects
subsequent reimport attempts only; it does not undo the first commit.

**Target:** Switching to `getDocsFromServer` with an offline error-handling
path would close the gap fully. Targeted for v0.14.0.

---

## Deviation 2 — No 'imported' `_changeLog` action on add path

**Spec pattern:** Import add emits
`_changeLog: [{ action: 'imported', ... }]`.

**CFD implementation:** `createProject` always emits
`{ action: 'created', ... }`.

**Consequence:** Imports and manual creates are indistinguishable.
Advisory only.

**Target:** v0.14.0 (M1).

---

## Deviation 3 — Local `_changeLog` wipe on replace

**Spec pattern:** `createdAt`, `_originRef`, `_changeLog` preserved on
replace in all modes.

**CFD v0.13.1:** `createdAt` and `_originRef` preserved (Phase 2).
`_changeLog` not preserved in local mode. Cloud mode preserves it via
`buildSavePayload` + `merge:true`.

**Consequence:** Local-mode replace loses change history. Advisory only.

**Target:** v0.14.0 (M1).

---

## Deviation 4 — Pitfall #59 case 6 not verified at integration level

**Spec contract:** "Single-project auto-switch happens only after create
write succeeds."

**CFD implementation:** `shouldAutoSwitch` (pure function) tested in
`import-utils.test.ts`. The wiring — `if (shouldAutoSwitch(...)) {
driver.setActiveProjectId(newId); ... }` in `project-list-context.tsx` —
is verified by structural review only.

**Mitigation:** Structural review confirms correctness; pure-function
tests verify the logic.

**Target:** v0.14.0 — Context-level integration test with mocked driver.

---

## Deviation 5 — Phase 4 accessibility and hint banners not covered by automated tests

**Spec contract:** Focus management, Escape gating, ARIA attributes, and
hint-banner behavior in `ImportPreviewSection` should be verified by
component tests.

**CFD v0.13.1:** Hook-level test 8 verifies `handleCancel` is
unconditional. No `ImportPreviewSection` component tests added (patch
scope).

Note: when both hint banners are visible simultaneously
(`driverLoading=true` AND `mode === 'cloud'` AND `existingCount === 0` AND
`incoming.length > 0`), two amber paragraphs stack. This is visually
acceptable; the component-test scope should verify both render correctly
when stacked.

**Target:** v0.14.0 —
`src/components/__tests__/import-preview-section.test.tsx` covering:

- Focus-on-mount (heading receives focus)
- Escape is a no-op during applying (applying=true → handleEscape does nothing)
- Escape cancels during driverLoading (driverLoading=true, applying=false → cancel fires)
- `aria-busy` on Confirm during applying
- `driverLoading` hint renders and is announced via live region
- Cloud-hydration hint renders when `mode === 'cloud' && existingCount === 0 && incoming.length > 0`
- Cloud-hydration hint does NOT render when `existingCount > 0` (non-empty workspace)
- Stable `role="status"` container behavior (live region does not announce empty state)

---

## Deviation 6 — Mid-session driver swap may write sample project to prior driver

**Context:** Sample-seeding branch calls `await
driver.createProject(sample)`. If the driver swaps between this await and
the subsequent state setters, the write targets the prior driver.

**CFD v0.13.1:** `if (cancelled) return` added after the second await
reduces the state-setter window but does not eliminate the write. This
deviation is informational; behavior in v0.13.0 is otherwise unchanged.

**Consequence:** Sample project created in wrong storage context.
Negligible probability.

**Target:** No fix planned.
