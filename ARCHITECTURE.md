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
│   ├── app-shell.tsx             # Top-level provider wiring + loading gate + ErrorBoundary
│   ├── error-boundary.tsx        # React Error Boundary for crash recovery
│   ├── confirm-dialog.tsx        # Custom confirmation modal (replaces browser confirm())
│   ├── consent-modal.tsx         # Clickwrap consent modal for Cloud Storage
│   ├── first-run-banner.tsx      # First-run informational banner
│   ├── footer.tsx                # App footer (version, copyright, license, legal links)
│   ├── project-selector.tsx      # Header bar: project dropdown, CRUD, import/export, Cloud Storage
│   ├── project-dashboard.tsx     # Main layout: sidebar + chart + grid
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
│   ├── project-list-context.tsx  # Project list, switching, CRUD
│   └── active-project-context.tsx # Active project data + 300ms debounced saves
│
├── lib/
│   ├── constants.ts              # APP_VERSION, TOS_VERSION, legal URLs, localStorage keys
│   ├── firebase.ts               # Firebase app/auth/firestore initialization
│   ├── consent.ts                # Consent localStorage helpers
│   ├── storage.ts                # localStorage CRUD (index + per-project keys)
│   ├── storage-health.ts         # Usage monitoring (3MB warning, 4.5MB critical)
│   ├── migrations.ts             # Semver-based migration framework
│   ├── sample-data.ts            # Sample project factory (14 snapshots, 5 states)
│   ├── calculations.ts           # Flow metrics: WIP, throughput, lead time, violations
│   ├── csv.ts                    # CSV parse (RFC 4180), export, column mapping, import
│   ├── colors.ts                 # 12 preset colors + W3C contrast calculation
│   ├── dates.ts                  # Date formatting + collection helpers (sort, merge)
│   ├── download.ts               # Browser file download + filename sanitization
│   ├── use-dismiss.ts            # useEscapeKey() + useClickOutside() hooks
│   ├── use-grid-navigation.ts    # 2D keyboard navigation (arrows, Tab, Enter, Escape)
│   ├── use-workflow-editor.ts    # Workflow state CRUD hook
│   └── __tests__/                # 10 test files, 136 tests
│       ├── calculations.test.ts
│       ├── colors.test.ts
│       ├── consent.test.ts       # Consent utility tests (v0.4.0)
│       ├── csv.test.ts
│       ├── dates.test.ts         # Date utility tests (v0.3.0)
│       ├── download.test.ts      # Download utility tests (v0.4.1)
│       ├── migrations.test.ts
│       ├── storage-health.test.ts
│       ├── storage.test.ts
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

Split localStorage design for scalability:

- **Index key** `cfd-lab` — stores `StorageIndex` (project list, active ID, version)
- **Project keys** `cfd-lab-project-{id}` — one key per project with full `Project` data

All storage functions include `typeof window === 'undefined'` guards for SSR safety. Contexts use deferred loading (empty initial state → `useEffect` loads from localStorage → `isLoaded` flag gates rendering) to prevent hydration mismatches.

Active project saves are debounced at 300ms via `ActiveProjectContext`.

## Context Architecture

Three contexts with intentional nesting order:

1. **AuthContext** — Firebase Auth state, sign-in/out methods, consent modal orchestration. Wraps the entire app.
2. **ProjectListContext** — project list, active project ID, CRUD operations. Changes here (switching projects, renaming) don't re-render the data grid or chart.
3. **ActiveProjectContext** — workflow, snapshots, settings for the active project. Provides `updateWorkflow`, `updateSnapshots`, `updateSettings` with debounced persistence.

`AppShell` nests them: `ErrorBoundary > AuthProvider > ProjectListProvider > ActiveProjectProvider > UI`.

## Auth & Consent Architecture

Two-tier legal consent model:

1. **Browsewrap** — Persistent footer links to ToS and Privacy Policy on all pages. No action required from users.
2. **Clickwrap** — Consent modal shown before Firebase Auth fires when enabling Cloud Storage. Requires checkbox agreement.

**Sign-in flow:** User clicks Cloud Storage → consent check (localStorage `spert_tos_accepted_version`) → show modal if needed → `signInWithPopup` → `onAuthStateChanged` fires → Firestore write to `users/{uid}`.

**Returning user flow:** `onAuthStateChanged` fires → check local cache → if miss, check Firestore → sign out on version mismatch.

Firebase is initialized from `NEXT_PUBLIC_FIREBASE_*` env vars. If not configured, sign-in UI is hidden and the app operates in local-only mode.

Firestore security rules for `users/{uid}` are managed centrally in the Firebase Console (shared across all six SPERT apps). Do not modify local `firestore.rules`.

## Migration System

Semver-based, matching the pattern from MyScrumBudget:

- `DATA_VERSION` in `constants.ts` is the single source of truth
- `migrations.ts` exports `INDEX_MIGRATIONS[]` and `PROJECT_MIGRATIONS[]` arrays
- Each migration has a `version` string and `migrate()` function
- `compareVersions()` handles semver ordering
- `loadIndex()` and `loadProject()` auto-detect stale data and run pending migrations
- Currently at v0.4.1; projects now stamped with `_version` on save for future migrations

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
