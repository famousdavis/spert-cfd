# Changelog

All notable changes to SPERT® CFD are documented here.

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
