# SPERT® CFD — Architecture

## Project Overview

SPERT® CFD is a Cumulative Flow Diagram tool for agile teams. Core functionality runs entirely in the browser with localStorage persistence. Optional Cloud Storage uses Firebase Authentication and Firestore for cross-device persistence. Licensed under GNU GPL v3 and deployable to Vercel.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Charts | Recharts 3 (stacked AreaChart) |
| Language | TypeScript 5.9 (strict mode) |
| Testing | Vitest 4 (node environment) |
| Dates | date-fns 4 |
| Icons | lucide-react |
| Drag & Drop | @dnd-kit (core + sortable + utilities) |
| IDs | nanoid (8-char) |
| Auth | Firebase Auth (Google, Microsoft) |
| Database | Firestore (optional Cloud Storage) |

## Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── page.tsx                  # Main page (renders AppShell)
│   └── changelog/page.tsx        # Static changelog page
│
├── components/
│   ├── app-shell.tsx             # Top-level provider wiring + tab state + loading gate + CloudStorageModal mount
│   ├── app-header.tsx            # Header: branding + Option C split pill auth chip — opens CloudStorageModal
│   ├── cloud-storage-modal.tsx   # Three-state Cloud Storage modal + Notifications toggle (auth-chip target)
│   ├── cloud-migration-flow.tsx  # Shared local→cloud migration UX (consumed by StorageSection + modal; see JSDoc re intentional cloud→local duplication)
│   ├── icons/google-logo.tsx     # Inline native-color Google G mark
│   ├── icons/microsoft-logo.tsx  # Inline native-color Microsoft four-square mark
│   ├── tab-navigation.tsx        # Pill-style tab bar (Projects | CFD | Settings | About)
│   ├── projects-tab.tsx          # Projects landing tab: card grid, add form, import/export
│   ├── project-row.tsx           # SortableProjectCard: draggable tile with stats + actions
│   ├── settings-tab.tsx          # Settings tab: StorageSection + SharingSection
│   ├── storage-section.tsx       # Storage mode toggle, auth UI; consumes CloudMigrationFlow
│   ├── sharing-modal.tsx          # Per-project sharing modal (cloud, owner manages)
│   ├── about-tab.tsx             # About page (Forecaster pattern)
│   ├── error-boundary.tsx        # React Error Boundary for crash recovery
│   ├── confirm-dialog.tsx        # Custom confirmation modal (replaces browser confirm())
│   ├── consent-modal.tsx         # Clickwrap consent modal for Cloud Storage
│   ├── first-run-banner.tsx      # First-run informational banner
│   ├── local-storage-warning-banner.tsx  # Data persistence warning (v0.4.7)
│   ├── footer.tsx                # App footer (version, copyright, license, legal links)
│   ├── project-dashboard.tsx     # CFD tab layout: sidebar + chart + grid
│   ├── chart/
│   │   ├── cfd-chart.tsx         # Memo'd Recharts AreaChart (Done bottom, Backlog top)
│   │   ├── chart-controls.tsx    # Toggleable legend
│   │   └── use-chart-data.ts     # Snapshot → chart data transform hook
│   ├── grid/
│   │   ├── data-grid.tsx         # Orchestrator: toolbar + table + dialogs
│   │   ├── grid-table.tsx        # Editable table with WIP highlights
│   │   ├── grid-cell.tsx         # Single numeric input cell
│   │   ├── grid-toolbar.tsx      # Add Row, CSV Export/Import, sort toggle
│   │   ├── add-row-dialog.tsx    # Date picker + carry-forward preview
│   │   └── csv-import-modal.tsx  # 3-stage: upload → mapping → confirm
│   ├── metrics/
│   │   ├── metrics-panel.tsx     # Period selector + metric cards + WIP violations
│   │   └── metric-card.tsx       # Single metric display
│   └── workflow/
│       ├── workflow-editor.tsx   # View/edit toggle for workflow states
│       ├── state-row.tsx         # Inline editing row with delete confirmation
│       └── color-picker.tsx      # 4×3 preset grid + hex input
│
├── contexts/
│   ├── auth-context.tsx          # AuthProvider: Firebase Auth + Firestore consent
│   ├── storage-context.tsx       # StorageProvider: active StorageDriver + useStorage()
│   ├── project-list-context.tsx  # Project list, switching, CRUD (via driver)
│   └── active-project-context.tsx # Active project data + saves via driver
│
├── lib/
│   ├── constants.ts              # APP_VERSION, TOS_VERSION, legal URLs, localStorage keys
│   ├── firebase.ts               # Firebase app/auth/firestore initialization
│   ├── consent.ts                # Consent localStorage helpers
│   ├── storage-driver.ts          # StorageDriver interface + StorageMode + ProjectListItem
│   ├── local-storage-driver.ts    # createLocalStorageDriver() — async wrapper over storage.ts
│   ├── firestore-driver.ts       # createFirestoreDriver(uid, db) — Firestore StorageDriver
│   ├── firestore-helpers.ts      # Collection constants, stripUndefined, appendChangeLogEntry
│   ├── cloud-migration.ts        # Local → cloud upload with collision detection
│   ├── storage.ts                # Low-level localStorage CRUD (consumed by local driver)
│   ├── storage-health.ts         # Usage monitoring (3MB warning, 4.5MB critical)
│   ├── migrations.ts             # Semver-based migration framework
│   ├── sample-data.ts            # Sample project factory (14 snapshots, 5 states)
│   ├── calculations.ts           # Flow metrics: WIP, throughput, lead time, violations
│   ├── csv.ts                    # CSV parse (RFC 4180), export, column mapping, import
│   ├── colors.ts                 # 12 preset colors + W3C contrast calculation
│   ├── dates.ts                  # Date formatting + collection helpers (sort, merge)
│   ├── download.ts               # Browser file download + standardized export filenames
│   ├── use-dismiss.ts            # useEscapeKey() + useClickOutside() hooks
│   ├── use-grid-navigation.ts    # 2D keyboard navigation (arrows, Tab, Enter, Escape)
│   ├── use-workflow-editor.ts    # Workflow state CRUD hook
│   └── __tests__/                # 13 test files, 193 tests
│       ├── calculations.test.ts
│       ├── colors.test.ts
│       ├── consent.test.ts       # Consent utility tests (v0.4.0)
│       ├── csv.test.ts
│       ├── dates.test.ts         # Date utility tests (v0.3.0)
│       ├── download.test.ts      # Download utility tests (v0.4.1)
│       ├── migrations.test.ts
│       ├── storage-health.test.ts
│       ├── storage.test.ts
│       ├── local-storage-driver.test.ts  # StorageDriver contract tests (v0.6.0)
│       ├── firestore-driver.test.ts     # FirestoreDriver tests with mocked SDK (v0.7.0)
│       ├── cloud-migration.test.ts      # Migration collision/upload tests (v0.7.0)
│       └── use-workflow-editor.test.ts
│
└── types/
    └── index.ts                  # All domain types
```

## Data Model

```
StorageIndex
  version: string              # Semver (e.g. "0.1.0")
  activeProjectId: string | null
  projectIds: string[]

Project
  id: string                   # nanoid(8)
  name: string
  createdAt: string            # ISO 8601
  updatedAt: string            # ISO 8601
  workflow: WorkflowState[]
  snapshots: Snapshot[]
  settings: ProjectSettings
  _version?: string            # Data version stamp (v0.3.0+)

WorkflowState
  id: string                   # nanoid(8)
  name: string
  color: string                # Hex (#rrggbb)
  category: 'backlog' | 'active' | 'done'
  wipLimit?: number            # Only on active states
  order: number

Snapshot
  date: string                 # ISO date (YYYY-MM-DD)
  counts: Record<stateId, number>

ProjectSettings
  gridSortNewestFirst: boolean
  showWipWarnings: boolean
  metricsPeriod: MetricsPeriod

MetricsPeriod (discriminated union, uses `kind` not `type`)
  { kind: 'all' }
  { kind: 'days', value: number }
  { kind: 'range', start: string, end: string }
```

## Storage Architecture

**Abstraction layer (v0.6.0) + cloud backend (v0.7.0):** All persistence goes through the `StorageDriver` interface, provided to the app via `StorageProvider` context. Contexts and components call `useStorage()` — no direct `storage.ts` imports outside the driver.

- `StorageDriver` — async interface: CRUD, preferences, real-time sync, export/import, flush
- `LocalStorageDriver` — wraps `storage.ts` functions with `Promise.resolve()`; `saveProject()` is a pure data write (no index side effects)
- `FirestoreDriver` — Firestore implementation with 500ms debounced writes, `hasPendingWrites` echo prevention, monolithic project documents, `stripUndefined()` for Firestore compatibility
- `StorageProvider` — auth-aware: uses `useState` lazy initializer, blocks children with loading spinner until driver is ready, flushes old driver before swapping on mode change

**localStorage keys:**

- **Index** `cfd-lab` — `StorageIndex` (project list, version)
- **Projects** `cfd-lab-project-{id}` — one key per project
- **Active project** `spertcfd-active-project` — dedicated key (migrated from `StorageIndex.activeProjectId` on first access)
- **Workspace ID** `spertcfd-workspace-id` — nanoid(8) for local-mode fingerprinting
- **Storage mode** `spertcfd-storage-mode` — `'local'` or `'cloud'`
- **Migration flag** `spertcfd-has-uploaded-to-cloud` — skips re-upload dialog on re-sign-in

**Firestore collections (cloud mode):**

- `spertcfd_projects/{projectId}` — monolithic project documents with `owner`, `members`, fingerprinting fields
- `spertcfd_profiles/{uid}` — user profiles for sharing UI email lookups
- `spertcfd_settings/{uid}` — per-user preferences (`projectOrder`)

All storage functions include `typeof window === 'undefined'` guards for SSR safety. Contexts use deferred async loading (`useEffect` → `await driver.loadProjectList()` → `isLoaded` flag gates rendering).

## Context Architecture

Four contexts with intentional nesting order:

1. **AuthContext** — Firebase Auth state, sign-in/out methods, consent modal orchestration. Wraps the entire app.
2. **StorageContext** — provides the active `StorageDriver` via `useStorage()`. Switches between `LocalStorageDriver` and `FirestoreDriver` based on auth state and user preference. Blocks children until driver is ready.
3. **ProjectListContext** — project list, active project ID, CRUD operations via driver, `reorderProjects()` for persistent drag order. Sample project seeding gated on `driver.mode === 'local'`.
4. **ActiveProjectContext** — workflow, snapshots, settings for the active project. Provides `updateWorkflow`, `updateSnapshots`, `updateSettings` with driver-managed persistence. Includes `beforeunload` flush handler.

`AppShell` nests them: `ErrorBoundary > AuthProvider > StorageProvider > ProjectListProvider > AppContent (tab state + ActiveProjectProvider) > UI`.

## Auth & Consent Architecture

Two-tier legal consent model:

1. **Browsewrap** — Persistent footer links to ToS and Privacy Policy on all pages. No action required from users.
2. **Clickwrap** — Consent modal shown before Firebase Auth fires when enabling Cloud Storage. Requires checkbox agreement.

**Sign-in flow:** User clicks Cloud Storage → consent check (localStorage `spert_tos_accepted_version`) → show modal if needed → `signInWithPopup` → `onAuthStateChanged` fires → Firestore write to `users/{uid}`.

**Returning user flow:** `onAuthStateChanged` fires → check local cache → if miss, check Firestore → sign out on version mismatch.

Firebase is initialized from `NEXT_PUBLIC_FIREBASE_*` env vars. If not configured, sign-in UI is hidden and the app operates in local-only mode.

Firestore security rules are managed centrally in the Firebase Console for the shared `spert-suite` project (all six SPERT apps). The `users/{uid}` consent collection is locked to owner-only access: `allow read, write: if isAuth() && request.auth.uid == uid`. Verified during v0.4.2 security audit.

## Migration System

Semver-based, matching the pattern from MyScrumBudget:

- `DATA_VERSION` in `constants.ts` is the single source of truth
- `migrations.ts` exports `INDEX_MIGRATIONS[]` and `PROJECT_MIGRATIONS[]` arrays
- Each migration has a `version` string and `migrate()` function
- `compareVersions()` handles semver ordering
- `loadIndex()` and `loadProject()` auto-detect stale data and run pending migrations
- Currently at v0.7.2; projects now stamped with `_version` on save for future migrations

## Key Conventions

- **Discriminated unions** use `kind` (not `type`) as the discriminant field
- **IDs** are `nanoid(8)` — 8-character random strings
- **Shared helpers** live in `dates.ts`: `sortSnapshots()`, `sortWorkflow()`, `mergeSnapshots()`, `daySpanBetween()`
- **Dismiss hooks** in `use-dismiss.ts`: `useEscapeKey()`, `useClickOutside()`
- **Version constant** `APP_VERSION` in `constants.ts` — used by footer and migration system
- **CFD band order**: Done on bottom, Backlog on top (bands rise as work flows through)

## Scripts

```bash
npm run dev            # Start dev server
npm run build          # Production build
npm test               # Run tests once (vitest run)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run lint           # ESLint
```

## Known Optimizations / Backlog

### Drop per-project hydration in `projects-tab` (post-v0.11.0 follow-up)

`src/components/projects-tab.tsx` currently calls `driver.loadProject(id)` for every project in a `useEffect` to compute `ProjectStats` (including `isOwner = full.owner === user.uid`). This is an N+1 read pattern: `driver.loadProjectList()` already fetches the full document set, and after v0.11.0 (PR [#41](https://github.com/famousdavis/spert-cfd/pull/41), F12) the list-level `ProjectListItem` shape carries `owner?: string` natively.

The hydration loop predates the F12 fix and was the only available path to ownership metadata at the list level. It can now be removed:

- Use `ProjectListItem.owner` directly when computing the Share-button gate (`onShare={driver.mode === 'cloud' && p.owner === user.uid ? ... : undefined}`).
- Other `ProjectStats` fields (snapshot counts, last-updated dates, etc.) — audit which still need a full-project load. If any do, keep the loop only for those; if none do, delete it entirely.
- Watch out: the v0.10.2 Share-button fix (commit `4c250e2`) is the regression target. The replacement must continue to gate on cloud mode AND ownership, and the modal-side `isOwner` check in `sharing-modal.tsx` stays as a second line of defense.

Estimated impact: removes one Firestore read per project on the Projects tab mount and on every `spert:models-changed` event (currently up to 25× the project count for a freshly-claimed batch). Becomes meaningful for users with 20+ projects or on slow connections.

Why deferred: out of scope for the bulk-sharing remediation PRs, and touching `projects-tab` while the v0.10.2 fix was a few commits old would have risked silent regression. Worth picking up as a focused follow-up once v0.11.0 has soaked in production.
