# Changelog

All notable changes to SPERT® CFD are documented here.

## v0.12.2 — Security audit closure (May 9, 2026)

Closes the v0.12.2 security audit's three actionable findings on the app side, ships alongside a coordinated `firestore.rules` deploy in spert-landing-page that closes M-1, M-2, and L-2 at the rule layer. v0.12.1's refactor work (extracted `InvitationSection`, test-infra hygiene, ESLint config tuning) is included in this ship — v0.12.1 was prepped on a feature branch but caught by the audit before deploy and rolled forward into v0.12.2 rather than shipped separately. See the v0.12.1 entry below for that work; the four sub-sections in this entry document only the v0.12.2 audit closure.

### Fixed (security)
- **M-3 — `Export All` no longer leaks cloud metadata** — `src/components/projects-tab.tsx` `handleExportAll` previously serialized cloud-mode projects via raw `JSON.stringify(allProjects, null, 2)`, leaking `owner` (UID), `members` (UID→role map), `schemaVersion`, `_originRef`, and `_changeLog` (each entry's `actor` UID) into the downloaded JSON file. Anyone receiving the file — tech-support thread, archive recipient, accidental email forward — saw every collaborator's Firebase UID. Each project now routes through `driver.exportProject(p)` (which strips the cloud-only fields) before being combined into the array. Matches the per-project Export button on the project tile and the multi-select Export Projects in Settings, both of which were already correct. Open since v0.10.0 (flagged at the time as out-of-scope follow-up); finally closed.
- **L-6 — legacy `handleAddMemberLegacy` path deleted** — `src/components/sharing-modal.tsx` carried a flag-off single-email add path with an unbounded `getDocs(query(collection, where('email','==',...)))` scan against `spertcfd_profiles`, plus a direct `setDoc` member-map merge that bypassed the bulk-invite Cloud Function's rate-limiting and notification throttling. Dead under `INVITATIONS_ENABLED=true` since v0.9.0 but a latent surface for L-1 (no `limit(1)`) and L-5 (role-cast laxity). Removed entirely: handler function, `email` state, `success` state (only set by the legacy handler), `isLoading` state (no longer read after the legacy form's removal), and the `INVITATIONS_ENABLED ? <InvitationSection /> : <legacy>` ternary collapsed to a single `INVITATIONS_ENABLED && <InvitationSection />` gate. Imports `collection`, `query`, `where`, `getDocs`, `PROFILES_COL`, `appendChangeLogEntry`, and the `ChangeLogEntry` type are gone with it. Bulk-invite via `callSendInvitationEmail` is now CFD's only add path; the CF handles existing-user auto-add via members-map merge so the legacy path's user-facing capability is preserved.
- **L-3 — resend-cap server-side enforcement documented in `InvitationSection`** — Added a SECURITY MODEL block comment above `InvitationSection`'s function declaration explaining that the 5/invitation cap is enforced server-side via `allow write: if false` on `spertsuite_invitations` (architectural backstop) plus the `resendInvite` Cloud Function (which rejects with `resource-exhausted` when `emailSendCount >= 5`). The per-row "Working…" disable on `handleResend` and the `(N/5)` display in `PendingInvitesList` are UX surfaces, not security controls. Without the comment, a future maintainer reading just the React code might assume the cap is client-enforced and weaken it. Cross-references the matching block in `firestore.rules`.

### Coordinated `firestore.rules` deploy (spert-landing-page)
Bundled into a single rules PR + `firebase deploy --only firestore:rules --project spert-suite`:
- **M-1 — `spertcfd_profiles` bulk-enumeration gap closed** — `allow read: if isAuth()` was permitting any authenticated SPERT-suite user (shared auth tenant) to call `getDocs(collection(db, 'spertcfd_profiles'))` and enumerate every CFD user's email/displayName/photoURL/updatedAt. Replaced with auth-only `get` + `limit(1)`-constrained `list`, matching the canonical pattern on `spertsuite_profiles`, `spertahp_profiles`, `spertstorymap_profiles`, `ganttapp_profiles`, and `spertscheduler_profiles`. The companion app-side L-6 deletion above removes the only client path that ever did a profile-collection scan; the active bulk-invite path goes through `callSendInvitationEmail` (Cloud Function) and never reads `spertcfd_profiles` directly.
- **M-2 — `spertcfd_projects` field allowlist** — Added `spertCfdProjectFields()` helper enumerating the 12 keys the driver ever writes (createProject + buildSavePayload + removeCollaborator transaction + handleChangeRole). Applied `keys().hasOnly()` on create and `affectedKeys().hasOnly()` on update so legacy docs with stale unknown fields stay editable while new unknown keys are rejected. Matches the v0.22.2 GanttApp / v0.42.6 Scheduler pattern.
- **L-2 — `spertcfd_settings` field allowlist** — `keys().hasOnly(['projectOrder'])` on write. Today the doc only stores `projectOrder` (per `firestore-driver.ts` `loadProjectOrder` / `createProject` / `deleteProject` / `reorderProjects`); the allowlist must be updated in lock-step if CFD ever adds more per-user settings.

### Verified clean (no finding)
The audit also verified the following surfaces against suite-wide patterns and found no gaps requiring remediation: H1 (suite invitation rules — `allow write: if false` on `spertsuite_invitations`), M5 (CFD owner-field binding on create — present since v0.7.0), M1 (project import explicit-property picking + `validateProjectData` + `sanitizeCloudFields`), A1 (in-memory state reset on sign-out via both context's `registerDataReset`), A2 (localStorage cleared on sign-out for all `cfd-lab-*` keys + `LS_ACTIVE_PROJECT` + `LS_HAS_UPLOADED`), A5 (centralized `runSignOutCleanup` — single sign-out path), C3 (saveProject payload excludes owner/members/schemaVersion via `buildSavePayload`), CSV formula injection (already neutralized via `escapeField` per CWE-1236), CSV import unknown-key surface (only writes counts to known `workflowStateIds`, no spread), XSS sinks (no `innerHTML` / `dangerouslySetInnerHTML` / `document.write` / `eval` / `new Function` anywhere in `src/`), `calculations.ts` dynamic exec (pure numeric, no eval), UID logging in error paths (only error codes/messages logged; never `user.uid`), `emailVerified` gate on `claimPendingInvitations` (still present at `auth-context.tsx:163`), invitation landing `SESSION_KEY` cleanup (consumed on success / grace timeout / dismiss), `removeCollaborator` transaction guards (three semantic guards intact), and local-driver invitation stubs (return correct empty state for cloud-only ops; UI gates on `driver.mode !== 'cloud'` before calling).

### Deferred (no fix in v0.12.2)
- **L-4 — `onProjectListChange` ordering race has no security impact** — assessed during the audit. The `membershipQuery()` runs server-side scoped to the calling auth context, and the order doc is read from `spertcfd_settings/{this-uid}`; both halves of any interleave touch this-user's data only. Worst case: stale order applied to current list (UX/correctness, not security). Existing TODO comment at `firestore-driver.ts:362` remains the tracking surface; re-evaluate if burst-write traffic patterns change.
- **L-5 — role assertion is type-cast not runtime-validated** — server-side defense holds (Firestore rules + CF input typing). Retired in practice with the L-6 legacy-path deletion (the legacy member-row select path was the primary L-5 surface). The bulk-invite role select still uses `as 'editor' | 'viewer'`; runtime guard not added in v0.12.2 because the CF runtime-validates role anyway.

### Tests
- 295 passing across 22 test files (unchanged from v0.12.1). No new tests required — M-3 is a 1-line behavior swap covered by manual verification, L-6 deletes dead code, L-3 is a comment.

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm test` — 295/295
- `npm run lint` — 0 errors / 0 warnings
- `npm run build` — succeeds
- Manual: with cloud-mode active project, `Export All` produces a JSON file whose entries have no `owner` / `members` / `schemaVersion` / `_originRef` / `_changeLog` fields; `SharingModal` shows the bulk-invite UI for owners (no legacy single-email form); pending-invite resend respects the 5-cap.

## v0.12.1 — Refactor & test-infra hygiene (May 9, 2026)

Refactor pass: one targeted component extraction, five test-only `tsc` errors cleared, and an investigation flag dropped into `firestore-driver.ts` for a rare ordering race surfaced during the v0.12.1 phase-1 audit. No production behavior changes; no dependency upgrades (every available bump is inside the 60-day soak window or requires per-dependency owner approval for a major-version cross). 295/295 tests still green across 22 files.

### Refactored
- **`InvitationSection` extracted from `SharingModal`** — `src/components/sharing-modal.tsx` was 624 LOC carrying three orthogonal responsibilities: project load + member list + role/remove controls (parent-owned), the legacy single-email add path (parent-owned), and the bulk-invite flow with its pending-invites list and revoke confirm dialog (now its own sub-component). Same-file declaration pattern matches Story Map v0.29.1 and GanttApp v0.22.1 — the sub-component lives below its parent so the file's concept surface stays contiguous while the bulk-invite state slice is fully isolated. Moved into `InvitationSection`: `bulkEmails`, `role`, `sending` (renamed locally from `isLoading` to avoid collision), `lastResult`, `pendingInvites`, `actionBusy`, `revokeTokenId`, plus the `refreshPending` callback + its triggering `useEffect`, `handleBulkSend` / `handleResend` / `handleRevoke`, the result-summary renderer, and the revoke `ConfirmDialog`. Invitation-flow errors now surface inside `InvitationSection`; the parent's `error`/`success` slot continues to serve the legacy add path, member removal, and role change. Parent re-renders authoritative project state via `onMembersUpdate` after each successful bulk send (Lesson 64 `Promise.allSettled` semantics preserved). The `INVITATIONS_ENABLED === false` legacy form, the member-list rendering, and the remove-member `ConfirmDialog` remain in the parent. Render-site swap is local: `{ownerStatus === 'owner' && (INVITATIONS_ENABLED ? <InvitationSection … /> : <legacy JSX />)}`. Behavior is identical end-to-end; the extraction is structural.

### Fixed (tests-only)
- **`tsc --noEmit` clean again — five test-file errors cleared** — Vitest 4.x's tightened mock signature inference and the v0.11.0/v0.12.0 `StorageDriver` interface extensions left scaffolding stale. (1) `src/lib/__tests__/cloud-migration.test.ts:46` — `createMockDriver` returned a partial `StorageDriver` missing `removeCollaborator`, `listPendingInvites`, `revokeInvite`, `resendInvite` (TS2739); added no-op async stubs. (2) `src/lib/__tests__/cloud-migration.test.ts:15`, `firestore-driver.test.ts:21`, `firestore-driver.test.ts:22` — `(...args: unknown[]) => mockDoc(...args)` failed TS2556 because `unknown[]` is not assignable to a fixed-arity tuple parameter list; the wrapper signatures now use `Parameters<typeof mockX>` so the spread is a tuple. Direct-pass (`doc: mockDoc`) was attempted first and rejected — vitest hoists `vi.mock` above the `const` declarations, so mock identifiers must remain inside an arrow body to defer access past TDZ. (3) `src/lib/__tests__/download.test.ts:47` — `Mock<Procedure | Constructable>` not assignable to `() => void`; the spy is now declared with an explicit signature `vi.fn<() => void>()`. No production-code changes in this bucket.

### Investigation flagged (not patched)
- **`onProjectListChange` async-snapshot ordering race** — `src/lib/firestore-driver.ts:362` registers an `async` snapshot callback that `await`s `loadProjectOrder()` mid-flight; rapid back-to-back snapshots (burst writes from accept-invite or bulk-share) can interleave such that a later snapshot resolves before the earlier one's order, applying stale ordering. A `TODO` comment now documents the failure mode and the two likely fixes (sequence-token guard, or order caching with explicit-reorder invalidation). Flagged for investigation before the next security audit; intentionally NOT patched speculatively in v0.12.1.

### Lint hygiene (pre-audit cleanup)
- **ESLint `@typescript-eslint/no-unused-vars` aligned with codebase conventions** — `eslint.config.mjs` now passes `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`, and `ignoreRestSiblings: true` to the rule. The `_`-prefix idiom (already used for stub method params in `local-storage-driver.ts` and the new reserved props on `InvitationSection`) and the destructure-to-strip-with-rest pattern in `firestore-driver.ts` `exportProject` (peeling `owner`, `members`, `schemaVersion`, `_originRef`, `_changeLog` off so `...data` is exportable) are now first-class. Cleared 12 of 13 baseline warnings.
- **`useMemo` invalidation-trigger silenced** — `src/components/project-dashboard.tsx:24` `useMemo(() => getStorageUsage(), [project?.updatedAt])` uses `updatedAt` as a recompute signal (a project save is what mutates the localStorage size that `getStorageUsage` reads) rather than a referenced input. Added `eslint-disable-next-line react-hooks/exhaustive-deps` with an explanatory comment. Cleared the 13th and last baseline warning.
- Net: `npm run lint` is now 0 errors / 0 warnings.

### Versioning
- `package.json` and `src/lib/constants.ts` `APP_VERSION` bumped to `0.12.1`.

### Tests
- 295 passing across 22 test files (unchanged from v0.12.0). No new tests required — the extraction is structural-only, and the test-infra fixes restore existing coverage rather than add new assertions.

### Out of scope (intentional)
- `firestore-driver.ts` (549 LOC) helper extraction to a `firestore-mappers.ts` sibling — cosmetic only; the factory pattern fights real decomposition and no genuine seam exists.
- All dependency upgrades — every available bump (firebase 12.13.0, next 16.2.6, react 19.2.6, vitest 4.1.5, lucide-react 1.14.0, tailwindcss 4.3.0, typescript 6.0.3, eslint 10.3.0, jsdom 29.1.1, etc.) was released within the past 60 days and/or is a major-version cross requiring explicit per-dependency owner approval.

## v0.12.0 — Bulk-sharing residual gaps (May 9, 2026)

Post-v0.11.0 verification audit found three residual gaps. PR-A ([#42](https://github.com/famousdavis/spert-cfd/pull/42)) closed P3; PR-B (this release) closes P8 and P9. Bundled because P8's `'error'` arm is the natural surface for P9's `Promise.allSettled` rejections.

### Fixed (Lesson 27 — PR-A [#42](https://github.com/famousdavis/spert-cfd/pull/42))
- **`spert:models-changed` handler now requires `SESSION_KEY` before flipping the banner to `claimed`** — `src/hooks/use-invitation-landing.ts` previously dispatched the claimed-banner UI on every `models-changed` event with a non-empty payload. A user signing in normally (no `?invite=` in this browser session) but with claimable pending invitations would see the banner appear unexpectedly. The handler is now extracted to a pure exported `handleModelsChanged(evt, deps)` whose first check is `sessionStorage.getItem(SESSION_KEY)` — no token in this session, no banner. Pending projects still appear in the list either way (via the `ProductList` listener path); the banner UX is reserved for users who arrived through an invite link. Five new tests in `src/hooks/__tests__/use-invitation-landing.test.ts` cover the gate, the success path, empty-payload short-circuit, empty-modelName filtering, and the `removeItem` throw being non-fatal. Establishes `src/hooks/__tests__/` as the hook-test directory paralleling `src/lib/__tests__/`. (Lesson 27)

### Fixed (Lesson 60 + 64 — PR-B)
- **`SharingModal` ownership state replaced with four-state `OwnerStatus` enum** — `src/components/sharing-modal.tsx` previously derived `isOwner = !!user && project?.owner === user.uid` synchronously from the loaded project, and the `loadProject` `.catch` swallowed errors silently. An offline / transient-network state stranded the modal on "Loading…" forever with only a console message. New `OwnerStatus = 'loading' | 'owner' | 'not-owner' | 'error'` derives from `project` + a new `loadError` boolean; the `.catch` now sets `loadError`, and the `'error'` arm renders a visible "Couldn't load sharing details. Refresh the page to try again." Four `isOwner` read sites (non-owner notice, member-row editor controls, add-UI gate, pending-invites gate) converted to `ownerStatus === 'owner'` / `'not-owner'`. The existing per-operation `error` string state is preserved as a separate surface for send/resend/revoke/remove failures — load-time vs operation-time errors do not share a state slot. (Lesson 60)
- **Post-send refresh uses `Promise.allSettled` and authoritatively re-fetches the project** — `src/components/sharing-modal.tsx` `handleAddInvitations` previously awaited `refreshPending()` only and relied on the cloud `onProjectChange` subscription to push the updated member list. Subscription latency could leave the result chips ahead of the member list, and a partial subscription failure would leave both stale. Now: `Promise.allSettled([driver.loadProject(project.id), refreshPending()])` runs both in parallel, applies the project result if fulfilled, and logs warnings on individual rejections so a pending-list failure does not discard a fulfilled member fetch. The subscription continues running for subsequent remote changes. (Lesson 64)

### Tests
- 295 passing across 22 test files (was 290 across 21 at v0.11.0). New: `handleModelsChanged` (5 cases — see above).

## v0.11.0 — Bulk-sharing retrograde audit remediation (May 8, 2026)

May 2026 retrograde audit against the suite-wide bulk-sharing guide closed
12 confirmed gaps across two PRs. Eight findings were verified NOT
APPLICABLE in CFD's architecture (see [#40](https://github.com/famousdavis/spert-cfd/pull/40) for the full disposition).

### Fixed (safety + latent prod risk — PR1 [#40](https://github.com/famousdavis/spert-cfd/pull/40))
- **`claimPendingInvitations` no longer fires for unverified Microsoft personal accounts** — `src/contexts/auth-context.tsx` now passes `firebaseUser` through to `claimPendingInvitationsAndNotify` and short-circuits on `!emailVerified`. Previously, every `onAuthStateChanged` resolution for an `@outlook.com`/`@hotmail.com`/`@live.com` user with `emailVerified === false` triggered a `failed-precondition` Cloud Function rejection that was logged silently. (Lesson 26)
- **CSP `connect-src` whitelist added** — `next.config.ts` now declares `connect-src 'self' https://*.cloudfunctions.net https://*.run.app https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com`. Both Cloud Functions Gen 1 (`*.cloudfunctions.net`) and Gen 2 (`*.run.app`) endpoints are required since Gen 2 routes transparently through Cloud Run. The previous CSP had no `connect-src` directive at all; CF calls worked only because `default-src` was also unset. The moment a `default-src` is added, all four invitation CFs would fail silently in production. (Lesson 24)
- **`removeCollaborator` wrapped in `runTransaction` with three semantic guards** — `src/lib/firestore-driver.ts` was a bare `updateDoc(deleteField())` call, field-write atomic but with zero protection for semantic invariants. Now: (1) pre-tx fast-fail if caller tries to remove themselves ("Cannot remove yourself from a project."), (2) in-tx caller-must-be-owner check ("Only the project owner can remove members."), (3) in-tx owner-not-target check ("Cannot remove the project owner."). Errors are plain `Error` objects; `SharingModal`'s catch surfaces `err.message` directly without routing through `mapInvitationError` (which is reserved for Cloud Function `FirebaseError` codes). (Lesson 50)
- **Cloud-mode auto-flip on invite-link click now gated on `localProjectCount === 0`** — `src/hooks/use-invitation-landing.ts` previously called `switchMode('cloud')` unconditionally when `?invite=` was detected. A user with local projects who clicked an invite link would land in cloud mode after sign-in with an apparently-empty project list (the local data was intact in localStorage, but the UX read as data loss). The hook now takes a `localProjectCount` parameter; `InvitationBanner` reads `useProjectList().projects.length` and passes it in. (Lessons 7, 28, 53)

### Fixed (correctness + hygiene — PR2)
- **`parseBulkEmails` partitions input into `{valid, invalid}`** — `src/lib/parse-bulk-emails.ts` was a pure normalizer returning `string[]`; malformed entries (missing `@`, missing TLD) were silently dropped before reaching the Cloud Function. The user got no feedback that "broken" or "alice.example" had been swallowed. The parser now applies the same `EMAIL_RE` the server uses; `SharingModal` merges invalid tokens into the result's `failed[]` array with `reason: 'invalid-format'` so they render as red chips alongside CF-side rejections. (Lesson 42)
- **Textarea retained on all-invalid batch** — Coupled to the parser change: if `valid.length === 0` after parsing, the CF is not called and the textarea content is preserved so the user can correct typos in place without re-pasting the whole list. Successful CF calls (mixed batches) still clear the textarea per existing behavior. (Lesson 43)
- **30-second grace timer auto-dismisses stranded `pre_auth` banner** — `src/hooks/use-invitation-landing.ts` had no timeout; an invitee landing on the page with `?invite=` and walking away without signing in would see the banner sit forever, and reloading would replay it from sessionStorage with no escape short of clearing site data. New Effect 4 fires after 30s in `pre_auth` state, consumes `SESSION_KEY` *before* `setState({ kind: 'idle' })` (Lesson 59 — without this ordering, a fast reload after the timer would replay the banner). Matches the Forecaster design (no `failed` state). (Lesson 59)
- **InvitationBanner restyled as centered card, not full-width strip** — `src/components/invitation-banner.tsx` was `max-w-7xl` (~1280px) with the dismiss button as a flex sibling. The banner is a primary CTA for an invitee who has just clicked an email link, not a passive status notification. Now: `max-w-lg mx-auto` (32rem ~512px), `relative` outer for absolute-positioned dismiss `top-2 right-2`, `pr-6` on inner content so longer copy doesn't run under the ×. Both `pre_auth` and `claimed` paths inherit the new layout. (Lesson 56)
- **`ProjectListItem.owner` re-attached at all list-level reload sites** — `src/lib/firestore-driver.ts` `loadProjectList` and `onProjectListChange` previously stripped the top-level `owner` field even though they were reading the same Firestore document that already carried it. Downstream consumers had to load the full project (N+1 reads) to compute `isOwner`. Now both list-level paths re-attach `data.owner`; `ProjectListItem` type gains `owner?: string` (optional because local mode has no ownership). The per-project `onProjectChange` listener was already correct via `mapDocToProject`. (Lessons 38, 49)
- **`.claude/` added to `.gitignore`** — Worktree directories under `.claude/worktrees/*` and Claude Code session-local files would otherwise show up as untracked.

### Refactored
- **Centralized Cloud Function wrappers in `src/lib/callables.ts`** — Replaces the four lazy `getXxx()` factories that returned `null` and required per-call-site null checks (`if (!callable) return;`). The new `requireFunctions()` guard throws an actionable `'Firebase Functions not initialized.'` error string instead of the SDK's opaque `TypeError: Cannot read properties of null`. Named wrappers (`callSendInvitationEmail`, `callClaimPendingInvitations`, `callRevokeInvite`, `callResendInvite`) unwrap the `r.data` envelope so call sites work with a clean `Promise<Result>`. Per the Q2 design decision, `callClaimPendingInvitations()` stays argless — the `emailVerified` short-circuit lives in AuthContext as the single source of truth. (Lesson 61)
- **Extracted `captureInviteTokenFromUrl()` to `src/lib/invite-capture.ts`** — Token-capture logic was inline in `useInvitationLanding`'s first effect, tangled with React state transitions and `router.replace` side effects. The pure module function reads `window.location.search` (not `useSearchParams`), writes to `sessionStorage`, and returns the token — testable without mounting the React tree. Per the spec, URL stripping stays in the hook because `router.replace` requires the App Router context. `SESSION_KEY` and `QUERY_PARAM` constants moved to the new module as the single source of truth. (Lesson 58)
- **Extracted `writeUserProfile()` to `src/lib/profile-writes.ts`** — Out of AuthProvider's private module scope into a dedicated module. Both writes (`spertcfd_profiles` + suite-wide `spertsuite_profiles`) preserved exactly; the function is now testable in isolation. Single-commit extraction per the Q decision (CFD has exactly one caller, so bisect-safety doesn't require Lesson 57's two-commit split). (Lesson 62)

### Tests
- 290 passing across 21 test files (was 268 across 19 at v0.10.2). New: `parseBulkEmails` (15 cases — partition behavior, mixed batches, missing-TLD/missing-@ rejection, cross-partition dedupe), `captureInviteTokenFromUrl` (7 cases — happy path, sessionStorage fallback, URL-token-wins-over-storage, no-token, flag-off short-circuit, idempotency, no-URL-mutation), `writeUserProfile` (11 cases — both collections written, email lowercased, null-email fallback, displayName denormalization, photoURL preserves null, `serverTimestamp()` placement per Lesson 29, `{ merge: true }` on both writes, payload mirroring symmetry, no-throw on rejection, db-null short-circuit).

## v0.10.2 — Share button now gated on project ownership (May 7, 2026)

### Fixed
- **Share button on the Projects tab is no longer visible to non-owners** — `src/components/projects-tab.tsx` previously passed `onShare` to every project card whenever the app was in cloud mode, so editors and viewers (who can't actually share) saw the button anyway. Clicking it would surface `SharingModal`'s read-only "Shared with you" view, but the affordance itself was misleading and inconsistent with the rest of the SPERT Suite (GanttApp gates correctly on `project.owner === user.uid`). Fix: thread `isOwner` through `ProjectStats` (computed during the existing per-project stats load) and gate `onShare` on both `driver.mode === 'cloud'` and `projectStats.get(p.id)?.isOwner`. The modal-side `isOwner` check in `sharing-modal.tsx` is preserved as a second line of defense.
- `src/components/project-row.tsx`: `ProjectStats` interface gains optional `isOwner?: boolean`.
- `src/components/projects-tab.tsx`: imports `useAuth`, populates `isOwner` from `full.owner === user.uid` during stats hydration, and adds `user` to the stats useEffect's dependency array.

## v0.10.1 — Banner width-cap follow-up (May 4, 2026)

### Fixed
- **First-run ToS banner, local-storage warning banner, and invitation banner all stretched edge-to-edge on wide displays** — v0.10.0 capped the header, tab nav, dashboard card, and footer at `max-w-7xl` but missed the three notification banners mounted between tab nav and content in `app-shell.tsx`. On 24"+ monitors the banners visually broke the otherwise-centered card layout: "Got it" buttons pinned to the far right edge of the viewport while everything above and below them stopped at the 1280px boundary.
  - `src/components/first-run-banner.tsx`: split outer (full-width `bg-blue-50 border-b py-3`) from inner (`mx-auto flex w-full max-w-7xl items-center gap-4 px-4`).
  - `src/components/local-storage-warning-banner.tsx`: same split with amber palette.
  - `src/components/invitation-banner.tsx`: replaced `mx-4 mt-3` with `mx-auto mt-3 w-[calc(100%-2rem)] max-w-7xl` so the rounded-card variant centers and caps at the same width.
- Verified at simulated 1700px effective viewport (CSS zoom): banner backgrounds span the page, content (text + buttons) centers within `max-w-7xl` with proportional gutters matching the header/footer/dashboard.

## v0.10.0 — Visual polish, trash icon, multi-select export (May 4, 2026)

### Changed
- **CFD dashboard width capped at `max-w-7xl`** — `src/components/project-dashboard.tsx` now wraps the sidebar+main row in a centered card against a `bg-gray-50` page background. On 24"+ monitors the dashboard no longer stretches edge-to-edge; on smaller laptops the layout is unchanged. Header (`app-header.tsx`), tab navigation (`tab-navigation.tsx`), and footer (`footer.tsx`) all gain `max-w-7xl` inner containers so their content edges align with the dashboard card on wide screens. The footer's `text-center` moved from the outer `<footer>` to the inner div so legal links remain centered within the constrained width.
- **Page background → `bg-gray-50`** — `src/app/layout.tsx` `<body>` now carries `bg-gray-50` so the centered white dashboard card has visual contrast on wide displays. Projects/Settings/About tabs (already capped at `max-w-4xl`) now read as content sitting on a framed page rather than floating in white.
- **About tab width unified to `max-w-4xl`** — `src/components/about-tab.tsx` switched from `max-w-[800px]` to `max-w-4xl` to match Projects and Settings. Pure consistency cleanup.
- **Project tile delete affordance: text "Delete" → trash icon (MyScrumBudget pattern)** — `src/components/project-row.tsx` replaces the bordered red text button with an icon-only `<Trash2 />` button: gray (`text-zinc-400`) by default, light-pink background + red icon (`hover:bg-red-50 hover:text-red-600`) on hover, with `transition-colors` for smooth state. `aria-label="Delete {name}"` for screen reader clarity. Confirmation flow (`ConfirmDialog` in `projects-tab.tsx`) is unchanged.

### Added
- **Multi-select Export Projects section in Settings** — new `src/components/project-export-section.tsx` mirrors SPERT Scheduler's `ExportSection` UX: per-project checkboxes, "Select all / Deselect all" toggle, and a single Export button labeled `Export (N)`. Lives below `StorageSection` in `settings-tab.tsx`.
  - **Cloud-safe serialization**: routes every selected project through `driver.exportProject()` (which strips Firebase `owner`, `members`, and internal `schemaVersion`) before combining into a JSON array. Single-project selection produces `spert-cfd-<projectname>-<timestamp>.json`; multi-project produces `spert-cfd-<timestamp>.json`. Both filenames use existing helpers from `src/lib/download.ts`.
  - **Name-only project list**: deliberate architectural choice — `ProjectListItem` only exposes `{id, name}`, and replicating the Projects-tab stats-loading pattern would fire N Firestore reads just to render Settings on cloud mode. Users selecting which projects to export don't need snapshot/state counts to make that decision.
  - The existing top-row "Export All" button on the Projects tab is kept as a one-click power-user shortcut. The per-card "Export" button on each project tile is also kept for fast single-project export without tab-switching.

### Notes
- Out-of-scope follow-up flagged: the Projects-tab "Export All" handler at `projects-tab.tsx:142-149` still uses raw `JSON.stringify(allProjects, null, 2)` and leaks `owner`/`members` UIDs in cloud mode. The new Settings export fixes this for its own path; aligning the Projects-tab path is a separate hygiene PR.

## v0.9.2 — Form-hygiene residual sweep (May 3, 2026)

### Fixed
- **`<input type="date" id="add-row-date">` now also carries `name="add-row-date"`** — `src/components/grid/add-row-dialog.tsx` had the id (matched by the adjacent `<label htmlFor>`) but no `name` attribute, the only field across the codebase the prior id+name pass missed.
- **Hidden Import-Project file input gets `id` + `name`** — `src/components/projects-tab.tsx`'s `<input type="file" className="hidden">` had neither attribute. Added `id="import-project-file"` + `name="import-project-file"`. Pure DevTools-issue cleanup; the input is programmatically clicked, so no behavior change.
- **`ColorPicker` hex input switched from a hardcoded `id`/`name` to `useId()`** — `src/components/workflow/color-picker.tsx` is rendered conditionally inside each `StateRow` of the workflow list, so the bare `id="color-picker-hex"` was a duplicate-id risk if two pickers ever coexisted in the DOM. Generated id via `useId()`, applied to both `id` and `name`. Preemptive hygiene; no observed UX path mounts two pickers simultaneously today.

### Notes
- After this sweep the codebase is clean against all five Chrome form-field hygiene rules (autoComplete, id-or-name, label association, htmlFor sanity, duplicate ids). 24 form fields total, 21 already compliant from prior passes, 3 fixed here.

## v0.9.1 — Firestore error-handling hygiene (May 3, 2026)

### Fixed
- **`SharingModal.handleChangeRole` now surfaces write errors** — the role-change `setDoc` was previously unhandled, so a Firestore failure left the dropdown silently reverted with no user feedback. Wraps the write in `try/catch` and pipes the error into the modal's existing `setError` state, which already renders inline at the bottom of the dialog body.
- **`onSnapshot` listeners in `firestore-driver.ts` now have error callbacks** — both `onProjectChange` and `onProjectListChange` previously passed only a success callback, so listener-side failures (permission revoked mid-session, network drop while subscribed) were swallowed. Each listener now receives a third-arg error handler that `console.error`s the Firestore error code. The codebase has no global notification surface and no per-doc subscription tracking set, so a user-visible toast and an automatic resubscribe path are deferred — this change closes the silent-failure gap without inventing infrastructure for it.
- **Collaborator-invite email field no longer autofills the inviter's own address** — `<input type="email">` in `SharingModal`'s legacy single-invite form had `autoComplete="email"`, which causes browsers to pre-fill the signed-in user's email into a field meant for entering someone else's. Switched to `autoComplete="off"` to match the field's actual purpose (sharing/lookup/invitation per the suite-wide convention).

## v0.9.0 — Bulk email invitations (May 3, 2026)

### Added
- **Bulk email invitations** — owners can paste up to 25 emails (comma, semicolon, or newline separated) and invite collaborators in one shot. Existing SPERT users are auto-added immediately and receive a "you've been added" notification email; unknown emails receive a one-time invitation link via Resend that expires in 30 days.
- **Pending invitations list** — owners see all outstanding invitations for a project with `Resend` and `Revoke` action buttons, send-count visibility (`N/5`), and expiry dates. Resend is capped at 5 per invitation server-side; Revoke uses the existing `ConfirmDialog` (no `window.confirm`).
- **Invitation claim flow with banner** — recipients clicking `?invite=tokenId` from an email land on the app, see a dismissible banner with inline Google + Microsoft sign-in CTAs, and after sign-in the banner transitions to a "you've been added to {project}" confirmation. Token is persisted in `sessionStorage` so it survives the OAuth popup AND the consent-modal flow. Storage mode auto-flips to cloud on `?invite=` detection so the freshly-claimed project is visible.
- **Suite-wide profile mirror** — `AuthContext.writeUserProfile` now dual-writes to both `spertcfd_profiles/{uid}` and the suite-shared `spertsuite_profiles/{uid}` so cross-app invitations from any SPERT app can resolve email→uid server-side.
- **Microsoft AD name normalization at write time** — `denormalizeLastFirst()` reorders Microsoft "Last, First Middle" displayName format to "First Middle Last" before it lands in either profile collection. Prevents the broken RFC 5322 From-line bug at the source.
- `src/lib/feature-flags.ts` — `INVITATIONS_ENABLED` toggle (now `true`).
- `src/lib/parse-bulk-emails.ts`, `src/lib/invitation-errors.ts`, `src/lib/auth-name.ts` — pure utilities, fully unit-tested (56 new test cases).
- `src/hooks/use-invitation-landing.ts` — App Router state machine using `useSearchParams` + `router.replace`; mounted under `<Suspense>` in `app-shell.tsx`.
- `src/components/invitation-banner.tsx`, `src/components/pending-invites-list.tsx` — new shell components.

### Changed
- **Cloud Functions generalized to multi-app** — `sendInvitationEmail`, `claimPendingInvitations`, and `resendInvite` in the suite-shared `spert-suite` Firebase project now branch on the caller's `appId` (`spertahp` | `spertcfd`) instead of hardcoding AHP. Project collection name derived as `${appId}_projects`; brand strings ("SPERT AHP" / "SPERT CFD") and origin allowlists are per-app maps. CFD model docs (no `collaborators` array, no `responses` map) skip the AHP-shaped writes via a `collaborators !== undefined` guard, so the universal `members.{uid}` mutation alone is sufficient. Shipped via [spert-landing#25](https://github.com/famousdavis/spert-landing/pull/25).
- **`SharingModal.handleRemoveMember` routes through `driver.removeCollaborator`** — replaces the prior inline `setDoc({ members })` read-modify-write with a targeted `members.{userId}: deleteField()` merge. Race-safe vs. concurrent owner edits and uses the storage-driver abstraction the rest of the app already lives behind.
- **`AuthContext` exposes `firebaseAvailable`** — `InvitationBanner` needs it to gate sign-in CTAs when Firebase isn't configured. Sign-in functions now typed as `() => Promise<void>` so banner CTAs can await completion.
- **`StorageDriver` interface extended** with `listPendingInvites`, `revokeInvite`, `resendInvite`, `removeCollaborator` — implemented in `firestore-driver.ts` (real callable wrappers + `tsToMillis` / `mapToPendingInvite` helpers) and stubbed as no-ops in `local-storage-driver.ts` (sharing is cloud-only).
- **`PendingInvite` and `InvitationStatus` types** added to `src/types/index.ts`. `modelId` field stores CFD's projectId — the suite-shared schema keeps the field name stable across SPERT apps.
- **Form-field accessibility cleanup** — every `<input>`, `<textarea>`, `<select>` across the app now has stable `id` and `name` attributes. Suppresses Brave/Chrome DevTools "form field element should have an id or name attribute" autofill hints. Per-row fields derive their identifier from the parent's stable id (e.g. `grid-cell-${date}-${stateId}`, `state-name-${state.id}`). No behavior change. Shipped via [#33](https://github.com/famousdavis/spert-cfd/pull/33).

### Notes
- Firebase Cloud Functions live in the `spert-landing` repo and were deployed and CORS-smoke-tested before this release.
- CFD's callable `appId` is `'spertcfd'` (no hyphen, matches collection prefix); distinct from CFD's `APP_ID` constant `'spert-cfd'` which remains the per-user consent-record discriminator.
- `isVoting` field is kept on `PendingInvite` for cross-suite schema compatibility but is always `false` from CFD and never rendered (no voting concept in CFD).
- Rollback: flip `INVITATIONS_ENABLED = false` in `src/lib/feature-flags.ts` and ship a patch release. The flag-off path preserves the legacy single-email-input UI byte-identically; pending invitations stay in Firestore and can be claimed later when the flag re-flips.

## v0.8.2 — Header icon polish (May 1, 2026)

### Changed
- **Header favicon styling aligned with SPERT® Suite** — applied `rounded-lg` and `ring-1 ring-white/20` to the favicon `<img>` in `src/components/app-header.tsx`, matching the SPERT® Scheduler convention. Pure CSS polish, no behavior change. Backfilled from [#30](https://github.com/famousdavis/spert-cfd/pull/30).

## v0.8.1 — Branded favicon + header icon (April 30, 2026)

### Added
- **Branded favicon and header icon** — new `spert-favicon-cfd.png` (192×192 PNG, purple `#7c3aed` panels with rounded corners) is wired as the browser tab favicon via `metadata.icons` in `src/app/layout.tsx` and rendered to the immediate left of the "SPERT® CFD" wordmark in `src/components/app-header.tsx`. A charcoal dark-mode variant (`spert-favicon-cfd-dark.png`) ships alongside it in `public/` for future use; the markup currently wires only the light variant since CFD has no theme hook yet.

## v0.8.0 — Cloud Storage Modal (April 26, 2026)

### Added
- **Cloud Storage modal launched from the auth chip** — single dialog handles all three valid auth × storage states (signed-out, signed-in-local, signed-in-cloud). Replaces the prior popover/Settings-tab routing from the auth chip.
- **Full-color Google and Microsoft sign-in buttons** — native-color brand SVGs on a unified blue background, equal-width row that wraps below ~320px viewport.
- **Notifications toggle** — "Warn me on startup when using local storage" controls the same `LS_SUPPRESS_LS_WARNING` key already read by `LocalStorageWarningBanner`, so the modal toggle and the banner's inline dismiss stay in sync automatically.
- `src/components/cloud-storage-modal.tsx` — the new four-state modal (state 4, signed-out + cloud, is structurally impossible).
- `src/components/cloud-migration-flow.tsx` — shared `forwardRef` component encapsulating the local→cloud migration UX (idle → confirm → migrating → done | error). Consumed by both `StorageSection` and the new modal so the migration flow is implemented once.
- `src/components/icons/google-logo.tsx` and `src/components/icons/microsoft-logo.tsx` — inline full-color brand SVGs.
- `normalizeDisplayName(displayName)` in `src/lib/user-display.ts` — sibling of `getFirstName`; swaps Microsoft Entra ID's "Last, First MI" to "First MI Last" for full-name display in identity cards.

### Changed
- `AppHeader` prop renamed `onNavigateToSettings` → `onOpenModal`; all three chip variants now open the new modal instead of routing to Settings or rendering a popover.
- `AppContent` (in `app-shell.tsx`) hoists `cloudModalOpen` state and mounts `<CloudStorageModal>` unconditionally so it bails internally when closed.
- `StorageSection` retains the same external behavior but now consumes `<CloudMigrationFlow ref={migrationRef} />` instead of inlining the migration state machine and panels. The Settings tab remains a secondary access path with full functionality.

### Removed
- `src/components/sign-out-popover.tsx` — fully replaced by the modal.
- `src/components/signed-in-local-popover.tsx` — fully replaced by the modal.

### Notes
- The cloud→local direction (`SwitchToLocalDialog` orchestration) is intentionally not extracted into `CloudMigrationFlow`. Each parent owns its own copy because the modal must remain open after the dialog resolves so the user sees the in-place transition to State 2, while `StorageSection` simply re-renders without that constraint. Rationale captured in `cloud-migration-flow.tsx`'s JSDoc and in ARCHITECTURE.md.
- Sign-out from the modal closes the modal explicitly via `onClose()` — no page reload. `onAuthStateChanged` cascades naturally and the chip re-renders to the signed-out variant.

## v0.7.8 — Banner Render Order Alignment (April 20, 2026)

### Changed
- **FirstRunBanner and LocalStorageWarningBanner now render below the header and tab navigation** — banners appear above the main content area instead of above the header, matching the layout convention used across the SPERT® Suite

## v0.7.7 — Auth/Storage Security Remediation (April 19, 2026)

### Fixed (Critical)
- **Sign-out now cancels pending Firestore writes before revoking credentials** — previously, the last ~500ms of edits were silently flushed with revoked credentials and rejected with `PERMISSION_DENIED` (finding A3)
- **Cross-user localStorage leakage on shared browsers** — project data under `cfd-lab*`, `spertcfd-active-project`, and `spertcfd-has-uploaded-to-cloud` are now cleared on sign-out so a subsequent user does not see or upload the prior user's projects (findings A2, A2-b, C3, D4)
- **`LS_HAS_UPLOADED` migration-skip bug** — this per-user flag was persisting across sign-out and silently skipping the upload dialog for the next user (finding A2)

### Fixed (Medium)
- **`saveProject` promise now correctly rejects on `setDoc` failure** — previously the promise hung forever on any Firestore write error (finding A3-c)
- **Coalesced `saveProject` promises now resolve on supersession** — no more hanging fire-and-forget awaiters (finding A3-d)
- **ToS Firestore write failure no longer orphans the consent record** — `LS_TOS_WRITE_PENDING` is now preserved on setDoc failure so the next sign-in retries Branch A (finding A7)
- **Auth chip now renders the signed-in + local state (d)** — avatar + first name + lock icon, with a popover offering "Switch to Cloud Storage" (navigates to Settings) and "Sign Out" (finding F2)
- **Cloud → local switch now prompts the user** — three-way dialog with "Keep Local Copy", "Discard", and "Cancel"; Keep copies in-memory cloud projects to this browser (finding C4, C5)
- **Migration reads from in-memory project list, not raw localStorage** — prevents cross-user data from being uploaded (finding C3)
- **`auth/popup-blocked` surfaces a user-visible banner** — "Popups are blocked. Please allow popups for this site and try again." (finding D1)

### Added
- `src/lib/sign-out-cleanup-registry.ts` — module-level registry bridging AuthProvider → StorageProvider for pre-sign-out cleanup
- `src/lib/app-data-reset-registry.ts` — synchronous in-memory reset registry so `ProjectListContext` and `ActiveProjectContext` can zero state during sign-out before the auth cascade fires
- `src/lib/user-display.ts` — shared `getFirstName(displayName, email)` utility, handles Microsoft Entra ID "Last, First" format
- `src/components/signed-in-local-popover.tsx` — new popover for the (d) auth chip state
- `src/components/switch-to-local-dialog.tsx` — three-button Keep/Discard/Cancel dialog for cloud → local switch
- `StorageDriver.cancelPendingSaves()` — discards pending debounced writes without firing them (used on sign-out)
- `AuthContext.signInError` / `clearSignInError` — surface auth popup errors to UI

### Changed
- `performSignOutWithCleanup` in `StorageProvider` runs the full ordered teardown: zero in-memory state → cancel pending writes → clear per-user localStorage → `firebaseSignOut`
- `migrateLocalToCloud` signature now accepts a `Project[]` array directly (breaking within-repo change; no external consumers)
- `SignOutPopover` now takes `firstName` instead of raw `displayName` for consistent display

### Preserved on sign-out (per-browser carve-outs)
- `spertcfd-storage-mode` (auto-resume intent)
- `spert_tos_accepted_version` (shared ToS document across all users)
- `spertcfd-workspace-id`, `spert_firstRun_seen`, `spert_suppress_ls_warning`

## v0.7.6 — Auth Chip Sign-Out Popover (April 9, 2026)

### Changed
- Auth chip in header is now a single `<button>` for both signed-in and signed-out states — one pill, one click target (matches SPERT® Suite convention)
- Signed-in: clicking anywhere on the pill opens a lightweight popover showing display name, email, and a **Sign out** button (no longer navigates to the Settings tab)
- Signed-out: clicking the pill still opens the existing sign-in flow via the Settings tab (unchanged)

### Added
- `src/components/sign-out-popover.tsx` — anchored popover with `role="dialog"`, Escape + outside-click dismissal, and a try/finally loading state (`"Signing out…"`) that guards against re-entry and dismissal mid-await
- `aria-haspopup="dialog"` / `aria-expanded` on the signed-in chip button, `aria-label` on both states, focus-visible ring for keyboard users

### Notes
- Popover sign-out handler mirrors the existing Settings → Storage sign-out (`signOut()` only, no `switchMode` side-effects) for parity

## v0.7.5 — Legal Update (April 5, 2026)

### Legal
- Updated Terms of Service and Privacy Policy to v04-05-2026
- Added SPERT® AHP to list of covered apps
- Updated effective date to April 5, 2026
- Bumped `TOS_VERSION` to `'04-05-2026'` (triggers re-consent for returning Cloud Storage users)

## v0.7.4 — Standardized Auth Chip (April 5, 2026)

### Changed
- Replaced header auth indicator with Option C split pill — consistent across all SPERT® Suite apps
- Signed-in cloud mode shows avatar circle (first initial, `#0070f3`) + first name + cloud icon linking to Settings
- Local/signed-out mode shows lock icon + "Local only" + "Sign in" link to Settings
- Removed separate "Cloud" text badge and full display name from header

## v0.7.3 — Per-Project Sharing UI (April 4, 2026)

### Added
- **Share button on project tiles** (cloud mode only) — opens a modal for per-project member management, following the GanttApp pattern
- **Sharing modal** (`src/components/sharing-modal.tsx`) — replaces the Settings tab sharing section; loads project by ID, real-time member updates via `onSnapshot`, escape key dismissal
- **"Shared" badge** on project tiles when a project has more than one member
- `memberCount` field in `ProjectStats` for badge display

### Changed
- Sharing UI moved from Settings tab to project tiles — now discoverable at the per-project level
- Settings tab now contains only `StorageSection` (storage mode, auth, migration)
- Non-owners see read-only "Shared with you" message in the sharing modal

### Removed
- `src/components/sharing-section.tsx` — replaced by `sharing-modal.tsx`

## v0.7.2 — Security Audit (April 4, 2026)

### Security
- Added application-level ownership checks to all sharing callbacks (`handleAddMember`, `handleRemoveMember`, `handleChangeRole`) — defense-in-depth beyond Firestore rules
- Added email format validation (RFC 5321, max 254 chars) before Firestore profile lookup in sharing UI
- Added `sanitizeCloudFields()` to strip malformed optional cloud/fingerprinting fields (`owner`, `members`, `schemaVersion`, `_originRef`, `_storageRef`, `_changeLog`) on project load and import — strips invalid fields rather than rejecting the entire document
- Fixed `renameProject` to trim whitespace before saving (was checking `!name.trim()` but storing untrimmed value)

### Investigated (no change needed)
- XSS via member UID display: React JSX escapes text content by default — not a vulnerability
- `_hasUploadedToCloud` localStorage flag: manipulation equivalent to clicking "Skip" in migration dialog — no security impact
- `_storageRef` in exported JSON: intentional fingerprinting field per ARCHITECTURE.md §9 — not PII
- `allow list: if isAuth()` Firestore rule: intentionally permissive, `allow get` gates data access — acknowledged
- `npm audit`: 5 transitive dependency vulnerabilities (next, undici, picomatch, flatted, brace-expansion) — all fixable only by upgrading parent packages deferred in v0.7.1; none affect CFD's usage
- CSP `connect-src` directive: not set, all connections allowed — future hardening opportunity, not a current vulnerability

## v0.7.1 — Refactor & Dependency Update (April 4, 2026)

### Fixed
- Added `.catch()` error handlers to all fire-and-forget driver operations in `ProjectListContext` (`createProject`, `deleteProject`, `renameProject`) and `ActiveProjectContext` (`loadProject`) — prevents unhandled promise rejections in cloud mode
- Added missing test for `_storageRef` injection in `LocalStorageDriver.exportProject` (Issue 7 coverage gap from v0.6.0)

### Dependencies
- Updated nanoid 5.1.6 → 5.1.7
- Updated recharts 3.7.0 → 3.8.1
- Updated tailwindcss 4.1.18 → 4.2.2
- Updated @tailwindcss/postcss 4.1.18 → 4.2.2
- Updated postcss 8.5.6 → 8.5.8

### Investigated (no change needed)
- `flush()` inside `setDriver` state updater: confirmed idempotent — second call finds empty `pendingWrites` map
- `activeProjectId` migration TOCTOU race: confirmed benign — writes identical value, localStorage is single-threaded
- `onProjectListChange` `hasPendingWrites` query-level suppression: intentional (Issue 8)
- `saveProject` debounce dangling Promise: callers fire-and-forget, same pattern as Story Map and MyScrumBudget

## v0.7.0 — Cloud Storage (April 4, 2026)

### Added
- **Optional Firebase cloud storage** with Firestore backend — opt-in via Settings tab
- `FirestoreDriver` factory (`src/lib/firestore-driver.ts`) — implements `StorageDriver` against Firestore with 500ms debounced writes, `hasPendingWrites` echo prevention, and monolithic project documents
- **Settings tab** fully populated: storage mode toggle (Local/Cloud), sign-in UI (Google/Microsoft), migration dialog, account info
- **Sharing UI** (`src/components/sharing-section.tsx`) — per-project member management with owner/editor/viewer roles, email-based member lookup via `spertcfd_profiles`
- **Local → Cloud migration** (`src/lib/cloud-migration.ts`) — uploads local projects to Firestore with collision detection (§21.13 `PERMISSION_DENIED` pattern), `_hasUploadedToCloud` flag prevents re-upload on re-sign-in
- **Real-time sync** in cloud mode — `onSnapshot` listeners on active project and project list; changes from other tabs/devices appear instantly
- **User profiles** written to `spertcfd_profiles/{uid}` on every sign-in for sharing UI email lookups
- **Cloud mode indicator** — "Cloud" badge in app header when in cloud mode
- **Fingerprinting fields** on `Project` type: `_originRef`, `_storageRef`, `_changeLog` (optional, backward compatible)
- Cloud metadata fields on `Project` type: `owner`, `members`, `schemaVersion` (optional)
- `ChangeLogEntry` type for structured audit trail
- Firestore helper utilities (`src/lib/firestore-helpers.ts`): `stripUndefined()`, `appendChangeLogEntry()`, collection name constants
- Security rules reference copy (`firestore.rules`) with `isCfdMember`/`isCfdOwner`/`isCfdEditor` helpers
- `.env.local.example` for new developer onboarding
- 17 new tests: 10 for `FirestoreDriver`, 7 for cloud migration (181 total across 13 files)

### Changed
- `StorageProvider` now auth-aware: blocks children with loading spinner until driver is ready, prevents flash of local data when cloud mode is active
- `StorageContextValue` expanded with `switchMode()`, `isCloudAvailable`, `storageReady`
- `firebase.ts` uses `initializeFirestore` with `memoryLocalCache()` instead of `getFirestore` — prevents stale security rule decisions in IndexedDB (§21.5)
- `LocalStorageDriver.exportProject` now injects `_storageRef: workspaceId` at export time (interface contract fix)
- App header simplified: sign-in UI moved to Settings tab, header shows cloud badge and user name only
- About tab "Your Data & Storage" section updated with Cloud Storage subsection

## v0.6.0 — Storage Abstraction Layer (April 4, 2026)

### Added
- `StorageDriver` interface (`src/lib/storage-driver.ts`) — async abstraction over persistence, supporting CRUD, preferences, real-time sync stubs, export/import, and flush lifecycle
- `LocalStorageDriver` factory (`src/lib/local-storage-driver.ts`) — wraps existing `storage.ts` behind the `StorageDriver` interface; all operations resolve immediately
- `StorageProvider` context (`src/contexts/storage-context.tsx`) — provides the active driver to all consumers via `useStorage()` hook; uses `useState` lazy initializer to prevent infinite re-render (GanttApp lesson)
- **Settings tab** (`src/components/settings-tab.tsx`) — fourth tab in navigation (Projects | CFD | Settings | About); placeholder for cloud storage UI in v0.7.0
- Dedicated `spertcfd-active-project` localStorage key for active project ID, with one-time migration from old `StorageIndex.activeProjectId`
- `spertcfd-workspace-id` localStorage key for local-mode fingerprinting (nanoid(8), created on first access)
- `beforeunload` flush handler in `ActiveProjectContext` for cloud-mode data safety
- Cloud-mode UI guards: storage indicator hidden and localStorage warning banner suppressed when `driver.mode === 'cloud'`
- 25 new tests for `LocalStorageDriver` (164 total across 11 files)

### Changed
- **Provider hierarchy** updated: `ErrorBoundary > AuthProvider > StorageProvider > ProjectListProvider > AppContent > ActiveProjectProvider`
- `ProjectListContext` refactored to consume `useStorage()` — all persistence via driver, no direct `storage.ts` imports
- `ActiveProjectContext` refactored to consume `useStorage()` — manual debounce logic removed (driver handles internally), load is async with cancellation
- `projects-tab.tsx` refactored to consume `useStorage()` — project stats loading converted from `useMemo` to async `useEffect`, export functions now async
- Sample project seeding gated on `driver.mode === 'local'` — cloud mode shows empty state instead
- Tab navigation expanded from 3 to 4 tabs (`TabId` union updated)

### Fixed
- **Priority 1:** Removed hidden index-update side effect from `saveProject()` in `storage.ts` (lines 89–93). Index bookkeeping now lives exclusively in `LocalStorageDriver.createProject()`, breaking the coupling that would have caused phantom index writes in cloud mode.

## v0.5.1 — Security Audit, Refactoring & Dependency Audit (April 3, 2026)

### Security
- Fixed CSV formula injection (CWE-1236): `escapeField()` now prefixes formula-triggering characters (`=`, `+`, `-`, `@`) with a tab character to prevent spreadsheet interpretation
- Added validation to `reorderProjects()`: incoming array must be a permutation of existing project IDs (same length, no duplicates, all IDs present) before persisting
- Tightened `validateProjectData()` for imported projects: `wipLimit` must be a positive finite number if present; snapshot dates must match `YYYY-MM-DD` format; `metricsPeriod.kind` must be a valid discriminant (`all` | `days` | `range`)
- Sanitized `console.error` calls in auth context to log only error codes, not full Firebase error objects

### Fixed
- Added `role="alert"` to Projects tab error banner for screen reader accessibility
- Removed unnecessary `handleRename` callback wrapper in Projects tab (passes `renameProject` directly)

### Changed
- Extracted shared `timestamp()` helper in `download.ts` to DRY up duplicated formatting in `exportFilename()` and `exportAllFilename()`

### Dependencies
- Updated @tailwindcss/postcss 4.2.1 → 4.2.2
- Updated @types/node 22.19.15 → 22.19.17
- Updated firebase 12.10.0 → 12.11.0
- Updated nanoid 5.1.6 → 5.1.7
- Updated recharts 3.8.0 → 3.8.1
- Updated tailwindcss 4.2.1 → 4.2.2
- Updated vitest 4.0.18 → 4.1.2
- Confirmed @dnd-kit packages at latest (core 6.3.1, sortable 10.0.0, utilities 3.2.2); mismatched majors are intentional

## v0.5.0 — Tab Navigation, Projects Tab & About Page (April 3, 2026)

### Added
- Three-tab navigation: **Projects** (default), **CFD**, and **About** tabs
- **Projects tab**: dedicated landing page with tile-style project cards, inline add form, and per-project Open / Export / Rename / Delete actions
- **About tab**: app overview, feature guide, storage info, author/source, trademark, license, and warranty disclaimer (follows SPERT® Forecaster pattern)
- Per-project summary stats on project cards: snapshot count, workflow state count, and last-updated date
- Drag-to-reorder project cards with persistent order (`@dnd-kit/core` + `@dnd-kit/sortable`)
- **Export All** button on Projects tab — bundles all projects into a single JSON download
- Standardized export filename pattern: `spert-cfd-<project>-<YYYYMMDD-HHmmss>.json` (and `.csv`)
- "Go to Projects" button on CFD tab empty state

### Changed
- Simplified app header (`AppHeader`): retains only branding and Cloud Storage auth controls; all project CRUD moved to Projects tab
- Projects and About tabs use centered `max-w-4xl` / `max-w-[800px]` layout; CFD tab remains full-width
- Tab navigation bar centered to align with tab content
- CFD chart animation disabled (`isAnimationActive={false}`) to prevent replay on tab switch
- Sample project data year updated to 2026 (dynamically uses current year in 2027+)
- Footer font size increased from `text-xs` to `text-sm` to match SPERT® Forecaster
- `ProjectListContext` now exposes `reorderProjects()` for persistent drag-to-reorder

### Removed
- `ProjectSelector` header component (replaced by `AppHeader` + `ProjectsTab`)

## v0.4.7 — localStorage Warning Banner (April 2, 2026)

- Added amber warning banner informing users that data exists only in the browser and can be lost without exporting
- Banner appears on every session load below the first-run banner
- "Got it" dismisses for the session; "Don't show again" checkbox permanently suppresses via `spert_suppress_ls_warning` localStorage key

## v0.4.6 — Legal & Branding Update (March 31, 2026)

- Updated Terms of Service and Privacy Policy to v03-31-2026
- Updated canonical legal document URLs to spertsuite.com
- Updated consent UI text to SPERT® Suite branding
- Added License link to app footer (links to GitHub LICENSE file)

## v0.4.5 — Legal Document Update (March 20, 2026)

- Updated Terms of Service and Privacy Policy (effective March 20, 2026)
- Replaced reference copies in /legal directory
- Bumped TOS_VERSION to 03-20-2026 (triggers re-consent for returning Cloud Storage users)

## v0.4.4 — First-Run Banner Update (March 16, 2026)

- Revised first-run notification text to include browsewrap consent language

## v0.4.3 — Node 22 LTS Pinning (March 11, 2026)

- Added engines field to package.json requiring Node >=22
- Created .nvmrc pinned to Node 22 for developer tooling and Vercel deployment
- Aligned @types/node to ^22 to match target runtime
- All dependencies verified compatible with Node 22 LTS (140 tests, clean build)

## v0.4.2 — Security Hardening (March 11, 2026)

- Added security headers: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy, and Content-Security-Policy
- Disabled X-Powered-By header to prevent framework fingerprinting
- Removed dead next.config.mjs (next.config.ts takes precedence)
- Enforced MAX_NAME_LENGTH (200) on project create, project rename, and workflow state rename
- Added maxLength attribute to all project and workflow state name inputs
- Added hex color format validation (#RRGGBB) in validateProjectData for imported projects
- Added color validation test cases (140 total tests across 10 files)

## v0.4.1 — Maintenance & Bug Fixes (March 11, 2026)

- Fixed data loss when navigating away during debounced save window (flush pending save on unmount)
- Fixed Cloud Storage dropdown not closing on outside click (added useClickOutside dismiss handler)
- Fixed workflow state name validation allowing empty names on import
- Added memoization for sortedSnapshots in DataGrid and importResult in CsvImportModal
- Extracted shared download utility (sanitizeFilename, downloadFile) to reduce duplication
- Improved Firebase type safety: removed unsafe null casts, added proper null guards
- Updated lucide-react to 0.577.0, recharts to 3.8.0, and other minor dependency updates
- Added download utility test suite (136 total tests across 10 files)

## v0.4.0 — ToS & Privacy Consent (March 11, 2026)

- Added persistent footer links to Terms of Service and Privacy Policy on all pages
- Added first-run informational banner for new visitors
- Added clickwrap consent modal for Cloud Storage enablement
- Added Firebase Authentication integration (Google and Microsoft sign-in)
- Added Firestore consent record with read-before-write and version checking
- Added returning-user ToS version check with automatic sign-out on mismatch
- Added reference copies of legal documents in /legal directory
- Added consent utility test suite (126 total tests across 9 files)
- Graceful local-only mode when Firebase env vars are absent
- Synced package.json version with APP_VERSION constant

## v0.3.2 — App Rebrand (March 10, 2026)

- Rebranded from CFD Laboratory to SPERT® CFD across UI, metadata, and documentation

## v0.3.1 — Copyright Attribution (March 10, 2026)

- Added copyright headers to all human-authored source files and root config files
- Updated LICENSE with author attribution block and GPL v3 Section 7 additional terms
- Added Copyright & Attribution Standing Instructions to CLAUDE.md

## v0.3.0 — Security & Stability (February 3, 2026)

- Added file size limits (1MB) for CSV and JSON imports
- Added length limits for project and workflow state names
- Improved export filename sanitization
- Added Error Boundary for graceful error recovery
- Fixed data integrity issues with rapid project operations
- Fixed "Last N days" metrics filter to be relative to data, not current date
- Fixed project data versioning for future migrations
- Replaced browser alert/confirm dialogs with custom modals
- Performance optimizations for workflow sorting and storage checks
- Added comprehensive tests for date utilities

## v0.2.0 — Dependency Upgrades (February 2, 2026)

- Upgraded to Next.js 16.1.6 and React 19.2.4
- Migrated to Tailwind CSS v4 with CSS-based configuration
- Migrated to ESLint 9 with flat config
- Upgraded Vitest to v4, date-fns to v4, Recharts to v3
- Updated all remaining dependencies to latest stable versions
- Resolved all npm audit vulnerabilities (0 remaining)

## v0.1.0 — Initial Release (January 31, 2026)

- Multi-project support with localStorage persistence
- Customizable workflow states with drag-to-reorder, color picker, and category assignment (backlog/active/done)
- WIP limits on active states with visual warnings
- Editable data grid with keyboard navigation (arrow keys, Tab, Enter, Escape)
- Add snapshots with carry-forward from previous day
- CSV export and import with auto-column-mapping
- Stacked area CFD chart with brush zoom and toggleable legend
- Flow metrics panel: WIP, throughput, arrival rate, and average lead time (Little's Law)
- Configurable metrics period (all data, last N days, or custom date range)
- Project export/import as JSON
- Sample project with demo data on first visit
- Data migration framework for future upgrades
