# SPERT® CFD — Architecture

## Project Overview

SPERT® CFD is a browser-only Cumulative Flow Diagram tool for agile teams. It runs entirely in the browser with localStorage persistence — no server, no database. Licensed under GNU GPL v3 and deployable to Vercel.

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
│   ├── footer.tsx                # App footer (version link, copyright, license)
│   ├── project-selector.tsx      # Header bar: project dropdown, CRUD, import/export
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
│   ├── project-list-context.tsx  # Project list, switching, CRUD
│   └── active-project-context.tsx # Active project data + 300ms debounced saves
│
├── lib/
│   ├── constants.ts              # APP_VERSION (single source of truth)
│   ├── storage.ts                # localStorage CRUD (index + per-project keys)
│   ├── storage-health.ts         # Usage monitoring (3MB warning, 4.5MB critical)
│   ├── migrations.ts             # Semver-based migration framework
│   ├── sample-data.ts            # Sample project factory (14 snapshots, 5 states)
│   ├── calculations.ts           # Flow metrics: WIP, throughput, lead time, violations
│   ├── csv.ts                    # CSV parse (RFC 4180), export, column mapping, import
│   ├── colors.ts                 # 12 preset colors + W3C contrast calculation
│   ├── dates.ts                  # Date formatting + collection helpers (sort, merge)
│   ├── use-dismiss.ts            # useEscapeKey() + useClickOutside() hooks
│   ├── use-grid-navigation.ts    # 2D keyboard navigation (arrows, Tab, Enter, Escape)
│   ├── use-workflow-editor.ts    # Workflow state CRUD hook
│   └── __tests__/                # 8 test files, 116 tests
│       ├── calculations.test.ts
│       ├── colors.test.ts
│       ├── csv.test.ts
│       ├── dates.test.ts         # Date utility tests (v0.3.0)
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

Two contexts isolate re-renders:

1. **ProjectListContext** — project list, active project ID, CRUD operations. Changes here (switching projects, renaming) don't re-render the data grid or chart.
2. **ActiveProjectContext** — workflow, snapshots, settings for the active project. Provides `updateWorkflow`, `updateSnapshots`, `updateSettings` with debounced persistence.

`AppShell` nests them: `ProjectListProvider > ActiveProjectProvider > UI`.

## Migration System

Semver-based, matching the pattern from MyScrumBudget:

- `DATA_VERSION` in `constants.ts` is the single source of truth
- `migrations.ts` exports `INDEX_MIGRATIONS[]` and `PROJECT_MIGRATIONS[]` arrays
- Each migration has a `version` string and `migrate()` function
- `compareVersions()` handles semver ordering
- `loadIndex()` and `loadProject()` auto-detect stale data and run pending migrations
- Currently at v0.3.0; projects now stamped with `_version` on save for future migrations

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
