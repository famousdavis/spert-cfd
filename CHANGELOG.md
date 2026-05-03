# Changelog

All notable changes to SPERT® CFD are documented here.

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
