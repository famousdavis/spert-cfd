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
│   ├── layout.tsx                # Root layout (fonts, metadata, the pre-paint theme script, ThemeSync; v0.20.0) and, since v0.22.0, AppShell around every route
│   ├── page.tsx                  # "/" — renders nothing: the tabs are AppShell's state (v0.22.0)
│   ├── not-found.tsx             # The framed 404: heading row "Page not found" + "Back to Projects" (v0.22.0)
│   └── changelog/page.tsx        # Static changelog page, inside the frame (heading row + capped body, v0.22.0)
│
├── styles/
│   └── spert-frame.css           # The SPERT® Suite frame's stylesheet, vendored byte for byte, never edited (v0.22.0; see App Frame)
│
├── components/
│   ├── app-shell.tsx             # The frame (v0.22.0): provider wiring + tab state + the framed loading states + skip link, header, nav, notices slot, main, footer + CloudStorageModal mount; held by the root layout
│   ├── app-header.tsx            # The frame's brand row (v0.22.0): the brand link (favicons + gradient title, see Dark Mode) + tagline (APP_DESCRIPTION) + theme button + the account chip (`.sf-chip`) — opens CloudStorageModal
│   ├── heading-row.tsx           # HeadingRow: the frame's heading row, the page's one h1 (+ toolbar) (v0.22.0)
│   ├── cloud-storage-modal.tsx   # Three-state Cloud Storage modal + Notifications toggle (auth-chip target)
│   ├── theme-toggle.tsx          # HeaderThemeToggle: the header's theme switch, System → Light → Dark (v0.20.0, see Dark Mode)
│   ├── theme-sync.tsx            # ThemeSync: keeps the `dark` class right on every route; in the root layout (v0.20.0)
│   ├── cloud-migration-flow.tsx  # Shared local→cloud migration UX (consumed by StorageSection + modal; see JSDoc re intentional cloud→local duplication)
│   ├── icons/google-logo.tsx     # Inline native-color Google G mark
│   ├── icons/microsoft-logo.tsx  # Inline native-color Microsoft four-square mark
│   ├── icons/toolbar-icon.tsx    # Dashboard toolbar icon (v0.17.0; paths in toolbar-icon-paths.ts, copied from GanttApp; 18 px since v0.18.0)
│   ├── icons/icon-buttons.tsx    # The tile's 28 px icon buttons, Trash · Export · Pencil · Share (v0.18.0) · Clone (v0.19.0), SPERT® Forecaster's glyphs
│   ├── icons/icon-button-styles.ts  # Their look: box, resting grey, one hue per action (Forecaster's, v0.18.0)
│   ├── icons/drag-handle.tsx     # The tile's six-dot grip (Forecaster's DragHandle, v0.18.0)
│   ├── dashboard-styles.ts       # The Projects dashboard's and the CFD-tab picker's class strings, Forecaster's at df59b2d (v0.18.0)
│   ├── toolbar-button-styles.ts  # The Projects toolbar's labelled buttons, Forecaster's (v0.18.0)
│   ├── tab-navigation.tsx        # The frame's navigation row (v0.22.0): Projects · CFD on the left, Settings · About · Help Center ↗ on the right; the active item underlined (`aria-current="page"`)
│   ├── projects-tab.tsx          # Projects landing tab: "Projects" + toolbar row (Export All · Import · Load Sample · New Project), the tile grid, the project dialog, focus after Delete (v0.18.0: Forecaster's dashboard); Clone's handler, its status region and failure alert, the welcome panel or the cloud pending line with no projects (v0.19.0)
│   ├── projects-empty-state.tsx  # The welcome panel: Forecaster's ProjectsEmptyState with CFD's words; Create New Project · Load Sample Project (v0.19.0)
│   ├── project-dialog.tsx        # The one New Project / Edit Project dialog: name only, page behind inert, Escape in the capture phase, focus back to the opener (v0.18.0)
│   ├── project-row.tsx           # ProjectTile / SortableProjectTile: Forecaster's tile (grip · name opens the CFD tab · badge · Delete; meta lines; revealed Share · Export · Edit · Clone) (v0.18.0; Clone v0.19.0)
│   ├── settings-tab.tsx          # Settings tab: StorageSection + ProjectExportSection + LocalWarningSetting
│   ├── local-warning-setting.tsx # Settings switch for the local-storage caution (v0.17.0)
│   ├── storage-section.tsx       # Storage mode toggle, auth UI; consumes CloudMigrationFlow
│   ├── sharing-modal.tsx          # Per-project sharing modal (cloud, owner manages)
│   ├── about-tab.tsx             # About page (Forecaster pattern)
│   ├── error-boundary.tsx        # React Error Boundary for crash recovery
│   ├── confirm-dialog.tsx        # Custom confirmation modal (replaces browser confirm()); Escape closes it alone (useModalEscape, v0.18.0)
│   ├── view-error-notice.tsx     # What an error boundary shows in place of a view (v0.16.4; own module v0.18.0)
│   ├── consent-modal.tsx         # Clickwrap consent modal for Cloud Storage
│   ├── first-run-banner.tsx      # First-run informational banner
│   ├── local-storage-warning-banner.tsx  # Data persistence caution; "Got it" hides it until the next page load (v0.4.7; card, v0.17.0)
│   ├── footer.tsx                # The frame's footer (version, copyright, license, legal links; `--sf-link`, v0.22.0)
│   ├── project-dashboard.tsx     # CFD tab layout: sidebar + chart + grid, a bordered panel filling the fitted main (X1, v0.22.0); the per-project key (the LOADED project's id) and the chart-and-grid error boundary sit here, below the picker (v0.18.0)
│   ├── project-picker.tsx        # "Cumulative flow for [project ▾]": names and switches the open project, above the chart (v0.18.0)
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
│   │   └── csv-import-modal.tsx  # 3-stage: upload (button or drag-and-drop) → mapping → confirm
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
│   ├── storage-driver.ts          # StorageDriver interface + StorageMode + ProjectListItem (cloud items carry owner, role, memberCount) + ProjectPlacement (a create placed after its source, v0.19.0)
│   ├── local-storage-driver.ts    # createLocalStorageDriver() — async wrapper over storage.ts
│   ├── firestore-driver.ts       # createFirestoreDriver(uid, db) — Firestore StorageDriver
│   ├── cloud-load-guards.ts      # Shape checks on project documents read from the cloud (v0.16.4)
│   ├── cloud-load-notices.ts     # Projects in which a cloud-load check set something aside (v0.16.4)
│   ├── firestore-helpers.ts      # Collection constants, stripUndefined, appendChangeLogEntry
│   ├── cloud-migration.ts        # Local → cloud upload with collision detection
│   ├── storage.ts                # Low-level localStorage CRUD (consumed by local driver)
│   ├── storage-health.ts         # Usage monitoring (3MB warning, 4.5MB critical)
│   ├── migrations.ts             # Semver-based migration framework
│   ├── sample-data.ts            # Sample project factory (14 snapshots, 5 states)
│   ├── calculations.ts           # Flow metrics: WIP, rates, cycle and lead time, violations
│   ├── csv.ts                    # CSV parse (RFC 4180), export, column mapping, import (dates normalized to ISO)
│   ├── colors.ts                 # 12 preset colors + W3C contrast calculation
│   ├── dates.ts                  # Date formatting + collection helpers (sort, merge)
│   ├── download.ts               # Browser file download + standardized export filenames
│   ├── use-dismiss.ts            # useModalEscape() (one capture-phase listener over a stack of open modals; closes the innermost) + useEscapeKey() + useClickOutside() hooks
│   ├── project-tile-meta.ts      # A tile's stats and meta lines: counts, the latest snapshot's date (v0.18.0)
│   ├── tile-access.ts            # What a tile offers: badges, Share, the Delete and Edit gates; cloud only (v0.18.0)
│   ├── tile-focus.ts             # Finding a tile's controls by project id; focus after a delete (v0.18.0)
│   ├── clone-project.ts          # Clone: the copy by an allowlist, its name, and which copy of the source (v0.19.0)
│   ├── project-order.ts          # placeAfter: a new id right after its source in the stored order (v0.19.0)
│   ├── order-move.ts             # withStoredSlots, reorderShown, moveAmongShown: a drop as a move on the order read now (v0.20.2)
│   ├── storage-errors.ts         # A local save refused because storage is full, and O24's words (v0.19.0)
│   ├── theme.ts                  # The theme preference (`spert-theme`): its rule, the store, THEME_SCRIPT (v0.20.0)
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

- `StorageDriver` — async interface: CRUD, preferences, real-time sync, export/import, flush. Since v0.19.0 `createProject(project, placement?)` takes an optional placement (Clone, DASH26 O22): local writes the id right after its source in the stored index (unreadable ids stay put, and a refused index write removes the project data it just wrote); cloud registers the create as in flight at once, reads the stored order strictly (an error or a cached read skips the placement), then issues the project write and the whole-order write in one synchronous run, with positioned creates taking turns, and keeps the `arrayUnion` append as the fallback
- **Project order: a drop is a move (v0.20.2, DASH26 R2o, O53a).** `moveProject({ draggedId, targetId, shownIds, heldIds })` replaces `reorderProjects(orderedIds)`, which wrote whatever list the tab held: in cloud mode a tab left open undid another device's reorder and a project the tab had not listed lost its place; in local mode anything but the exact index was refused silently, so one unreadable project or another tab's new one made every drop do nothing. Now the driver applies the move to the order it reads at the time (`order-move.ts`): the dragged id takes the target's place among the shown ids, and every other stored id keeps its slot. **Cloud:** the order is read from the server (`readStoredOrder`); when that fails (offline), the driver's `lastOrder`, the last order it read or wrote (`[]` for a read that found no document), is used instead, so an offline drop is still queued and sent on reconnect; a driver that never read an order writes nothing (`unread`). Not the SDK's cache: offline, a read of a settings document that did not exist rejects rather than answering "none". The base is `withStoredSlots(order, heldIds)` (held ids the order lacks, such as shared projects, are appended), the move is made in it, and the whole array is written, taking turns with positioned creates (`orderTurn`); the outcome waits for the server's acknowledgement, and a refused write is `failed`. A list read that began before a whole-order write and answers after it does not become `lastOrder` (`orderWrites`). A plain create's `arrayUnion` still has no turn: one landing between a move's read and its write leaves the new id unordered (sorted last), never removed. **Local:** the move is made within the index as read now, with no id added; a move naming an id the index lacks is `refused`, and a guard refuses any result that is not exactly the index's ids. An offline drop builds on `lastOrder`, so when it lands on reconnect it can replace an order another device stored meanwhile (measured, PR #114 review -03), as before v0.20.2. The guard on the local result cannot fire through `moveAmongShown`, which always returns the index's own ids; it is a stated defence against a later change, tested by making the move return a wrong list (`local-move-guard.test.ts`). The outcome (`written` with the order, `unchanged`, `refused`, `unread`, `failed`) goes back to `ProjectListContext`, which shows the drop at once, then the order written, or the order before the drop when nothing was written
- **Tile colour and archive: each person's own (v0.21.0, DASH26 R2).** Five colours (`blue`, `teal`, `slate`, `purple`, `pink`) or none, and `archived: true` or absent, per project id, in the person's settings, never on the project (`project-prefs.ts`). The driver is the one store: `getProjectPrefs()` / `onProjectPrefsChange()` (read through `useProjectPrefs`), `setProjectPref(id, field, value)` returning a refusal or null, `retryProjectPrefs()`. **Local:** the key `spertcfd-project-prefs`, every change re-reading it and writing one field (two tabs lose nothing; another tab's change shows at the next change or reload; the upload and Delete read or clear the key itself, never this tab's copy in memory, PR #115 review); storage full and the 1,000-entry cap refuse with a message. **Cloud:** `spertcfd_settings/{uid}.projectPrefs`, read ONCE with the order by the first settings read that reaches the server (a missing document is `{}`); later reads touch the order only, so a change still waiting is never replaced. A failed or cached read is `failed`, not "no settings": the Projects tab says so in one line and turns Tile color, Archive and drag off until a read succeeds, retried at each list snapshot and reload, on the window's `online` and `focus` events, when the page becomes visible and when the Projects tab mounts (a list listener does not fire at reconnect when the list did not change, and an SDK that went offline while the browser stayed online gets no `online` event: measured; the line says to switch away and back, or reload, to try again). Writes go per field after a 200 ms debounce under their own timer (`firestore-prefs.ts`: one `FieldPath('projectPrefs', id, field)` each, `deleteField()` to clear, never through `stripUndefined`, never an entry or map mask, never a dotted string; emptying both fields leaves `{}`, which reads as no entry); `flush()` sends them (at unload and unmount the write is sent, not known to land: a change made in the last moments before the page closes can be lost, as a project save can), `cancelPendingSaves()` drops them (sign-out). A write the server refuses puts the map back from a fresh server read (changes still waiting or on their way kept; a read that fails too leaves `failed`) and the Projects tab says so in the local path's retry words (`onProjectPrefsRefused`; one no listener heard is told to the next). Ids no entry may have (`''`, `__x__`, any `Object.prototype` member name: an entry at `hasOwnProperty` kills the reading client, measured) are refused everywhere, and such a tile's controls say why. **Lifecycle:** Clone copies the colour, never the archive; Delete drops both fields once the driver's delete resolves, whatever this tab's map holds (a `deleteField()` of an absent field creates nothing); deleting the open project opens the first project not archived, else the first; Import keeps entries by id and names the written projects left archived; Export carries neither; the upload writes each project's entry under its cloud id right after its create (both fields masked, awaited), and a refused one names the project after the switch to Cloud (`migrateLocalToCloud` returns the id pairs, or throws an `UploadError` carrying them); Keep local copy (`keep-local-copy.ts`) writes each copied project's cloud entry into the local key, an empty one included, so a stale local entry for that id is cleared (exact); nothing prunes. **On screen:** the context's `projects` stays the full list; only the grid, the drag (dnd-kit's items and `moveProject`'s `shownIds`) and focus read the shown list (`use-project-archive.ts`). Archiving the open project keeps it open, and the CFD tab's picker lists archived projects marked "(archived)" (R35)
- `LocalStorageDriver` — wraps `storage.ts` functions with `Promise.resolve()`; `saveProject()` is a pure data write (no index side effects)
- `FirestoreDriver` — Firestore implementation with 200 ms debounced writes (`DEBOUNCE_CLOUD_MS`; the text said 500ms until v0.21.0), `hasPendingWrites` echo prevention, monolithic project documents, `stripUndefined()` for Firestore compatibility
- `StorageProvider` — auth-aware: uses `useState` lazy initializer, blocks children with loading spinner until driver is ready, flushes old driver before swapping on mode change

**localStorage keys:**

- **Tile colour and archive** `spertcfd-project-prefs` (v0.21.0, DASH26 R2, O56) — this browser's map in local mode, `{ [projectId]: { color?, archived?: true } }`; never on the project or in `cfd-lab`; each change re-reads the key and writes one field (O63); kept at sign-out, as local projects are

- **Index** `cfd-lab` — `StorageIndex` (project list, version)
- **Projects** `cfd-lab-project-{id}` — one key per project
- **Active project** `spertcfd-active-project` — dedicated key (migrated from `StorageIndex.activeProjectId` on first access)
- **Workspace ID** `spertcfd-workspace-id` — nanoid(8) for local-mode fingerprinting
- **Storage mode** `spertcfd-storage-mode` — `'local'` or `'cloud'`
- **Migration flag** `spertcfd-has-uploaded-to-cloud` — skips re-upload dialog on re-sign-in
- **Theme** `spert-theme` (v0.20.0, DASH26 RD2) — `light`, `dark` or `system`; missing or anything else means System. SPERT® Forecaster's key, but per site: a choice made in Forecaster does not reach CFD. Written only by the header's switch (`theme.ts`, see Dark Mode)
- **Invite request** `spertcfd-invite-cloud-pending` (v0.19.0, DASH26 R26) — an invite link opened with no local projects asks for Cloud at the next sign-in, which switches only if the local list is still empty then (`use-invitation-landing.ts`). Used once, at the next sign-in on this browser, whoever signs in; the banner's Dismiss, its timeout and sign-out do not clear it

**Firestore collections (cloud mode):**

- `spertcfd_projects/{projectId}` — monolithic project documents with `owner`, `members`, fingerprinting fields
- `spertcfd_profiles/{uid}` — user profiles for sharing UI email lookups
- `spertcfd_settings/{uid}` — per-user preferences: `projectOrder` and, since v0.21.0, `projectPrefs` (each person's own tile colour and archive per project; the rules, landing v2.14.3, check keys only)

**Cloud reads are checked, not trusted (v0.16.4).** Any editor of a shared project can write its document, so `mapDocToProject` and both project-list paths read it through `cloud-load-guards.ts`:
- a snapshot or workflow state that cannot be read is set aside, a field of the wrong type takes its default, and the rest loads;
- a name that is not text reads as empty;
- the checks never throw and never write.

They do **not** reuse `validateProjectData`, which rejects a whole document. `saveProject` writes name, workflow, snapshots and settings back whole, so every check accepts everything the app's own writers produce. `CloudLoadNoticeBanner` names each project in which something was set aside. An `ErrorBoundary` with a `fallback` wraps the current tab in `app-shell.tsx`, inside the app-wide one; since v0.22.0 the tab's heading row sits outside it (CFD, Settings, About), so a failed view keeps its `h1` and the frame.

All storage functions include `typeof window === 'undefined'` guards for SSR safety. Contexts use deferred async loading (`useEffect` → `await driver.loadProjectList()` → `isLoaded` flag gates rendering).

## Context Architecture

Four contexts with intentional nesting order:

1. **AuthContext** — Firebase Auth state, sign-in/out methods, consent modal orchestration. Wraps the entire app.
2. **StorageContext** — provides the active `StorageDriver` via `useStorage()`. Switches between `LocalStorageDriver` and `FirestoreDriver` based on auth state and user preference. Blocks children until driver is ready.
3. **ProjectListContext** — project list, active project ID, CRUD operations via driver, `moveProject()` for drag-and-drop (v0.20.2: the move goes to the driver, never a list; the tiles move at once, drops not yet answered are made again on top of each order written, so a second quick drop never shows the first undone, and the list shows the order it had before a drop when nothing was written; drops still waiting are dropped whenever the driver changes, and an answer from a replaced driver changes nothing on screen (PR #114 review -01). The order shown after a drop is the order saved, which in a tab behind another tab's or device's change can differ from the drop made on screen: local mode has no `storage` listener, and the cloud list listener never sees a settings write). No sample is seeded (v0.19.0, DASH26 R20): an empty list stays empty in both modes, and an empty list opens nothing even when the active-project key names a project; until v0.18.0 an empty local list re-seeded the sample. `loadSampleProject()` (v0.17.0, the Load Sample button) adds a fresh sample in either mode through the same add path as `createProject()`. `cloneProject()` (v0.19.0) takes that path with a placement: the copy goes right after its source, on screen at once and in the stored order, and the open project does not change. A project this browser creates is listed in cloud mode as the person's own (`role: 'owner'`, one member) once its create has landed, since the list listener never delivers this device's own create; not before, while the document may not exist on the server yet. A create the driver refuses synchronously (local storage full) rejects before anything is listed or activated, so an edit kept in memory after a refused save survives it. A clone is named, and placed, against the list as it is when the copy is added, not as it was at the click. `driverLoading` is set during render on a swap to a cloud driver, so an empty list never shows as loaded for a frame.
4. **ActiveProjectContext** — workflow, snapshots, settings for the active project. Provides `updateWorkflow`, `updateSnapshots`, `updateSettings` with driver-managed persistence. A save refused because the browser's storage is full (v0.19.0, DASH26 R25) no longer throws out of the state updater, which used to replace the whole app: the edit stays in the copy, and `storageFull` (with `dismissStorageFull`) raises the CFD tab's alert until Dismiss or the next save that succeeds. Includes `beforeunload` flush handler. Each save writes its in-memory copy whole, name included, while a rename is saved by `ProjectListContext.renameProject`; so when the list's name for the open project changes, the copy takes it (v0.17.6), and only then: in cloud mode another editor's rename can reach the copy before the list (`rename-open-project.test.tsx`). An import that replaces the open project reaches the copy too: local mode reloads it from storage (`projectUpdateKey`). In cloud mode the doc listener never hears this device's own save, so the copy takes the import's name, workflow, snapshots and settings from `importedActiveProject` (v0.17.7, `emulator-tests/import-replace-open.test.tsx`).

`AppShell` nests them: `ErrorBoundary > AuthProvider > StorageProvider > ProjectListProvider > AppContent (tab state + ActiveProjectProvider) > UI`. Since v0.22.0 the root layout holds `AppShell` around every route (`/`, `/changelog`, the 404), so every route mounts auth and storage; it mounts `ThemeSync` before it (v0.20.0), outside every boundary (see Dark Mode). While the storage driver is not ready, `StorageProvider` renders its `fallback`, which AppShell sets to the frame with only its body loading (see App Frame).

## Auth & Consent Architecture

Two-tier legal consent model:

1. **Browsewrap** — Persistent footer links to ToS and Privacy Policy on all pages. No action required from users.
2. **Clickwrap** — Consent modal shown before Firebase Auth fires when enabling Cloud Storage. Requires checkbox agreement.

**Sign-in flow:** User clicks Cloud Storage → consent check (localStorage `spert_tos_accepted_version`) → show modal if needed → `signInWithPopup` → `onAuthStateChanged` fires → Firestore write to `users/{uid}`.

**Returning user flow:** `onAuthStateChanged` fires → check local cache → if miss, check Firestore → sign out on version mismatch.

Firebase is initialized from `NEXT_PUBLIC_FIREBASE_*` env vars. If not configured, sign-in UI is hidden and the app operates in local-only mode.

Firestore security rules are managed centrally for the shared `spert-suite` project (all SPERT apps). The canonical ruleset lives in the Landing Page repo and, since 2026-08-19, **deploys via CI on merge to that repo's `main`** rather than by Firebase Console paste-replace; a scheduled job compares the deployed rules against the file and fails on divergence. The `users/{uid}` consent collection is locked to owner-only access: `allow read, write: if isAuth() && request.auth.uid == uid`. Verified during v0.4.2 security audit.

### Sign-Out Paths and Cleanup Guarantees (v0.14.0)

Three distinct sign-out paths call `performSignOutWithCleanup` (registered via
`signOutCleanupRegistry`), which in order:

1. Calls `runDataReset()` — zeros in-memory project state synchronously
2. Calls `driverRef.current?.cancelPendingSaves()` — cancels pending cloud writes
3. Calls `clearCloudSessionKeys()` conditionally — only when driver is in
   cloud mode. It removes `spertcfd-active-project` (the cloud project id, the
   only key a cloud session writes) and `spertcfd-has-uploaded-to-cloud` (so the
   upload prompt is offered again). Local projects (`cfd-lab`, `cfd-lab-project-*`)
   are kept in both modes: v0.7.7 cleared them, F3 (v0.14.0) stopped that in
   local mode, v0.15.20 in cloud mode — the cloud driver never writes them, so
   they hold only projects the user kept locally (after Skip, an upload that
   kept local copies, or work done signed out)

`performSignOutWithCleanup` intentionally does NOT call `firebaseSignOut`. Callers own that step.

**Path 1 — User-initiated:** `handleSignOut` → `runSignOutCleanup()` →
  `firebaseSignOut(auth)` → `onAuthStateChanged(null)` → Path 3 (idempotent re-run)

**Path 2 — ToS-mismatch:** `clearLocalConsent()` → `runSignOutCleanup()` →
  `firebaseSignOut(auth)` → `onAuthStateChanged(null)` → Path 3 (idempotent re-run)

**Path 3 — Externally-revoked:** `onAuthStateChanged(null)` →
  `try { runSignOutCleanup() } catch {...} finally { setUser(null); setIsAuthLoading(false) }`
  No `firebaseSignOut` — credentials already revoked; calling it would loop.

All cleanup steps are idempotent. Double-invocation (Paths 1/2 → Path 3) is safe.

**Accepted gap — I1a:** Snapshot callbacks lack a `auth?.currentUser?.uid !== uid` guard.
The driver is recreated on uid change (StorageProvider's driver-swap useEffect), covering
the race for the vast majority of cases. The `auth` object is not imported by the driver,
so adding the guard would require a structural change. Accepted as low-risk.

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
- **Dismiss hooks** in `use-dismiss.ts`: `useEscapeKey()` (bubble phase) for a popover or panel, `useClickOutside()`; every modal window uses `useModalEscape()` (v0.18.0): the project dialog, the confirmation, the Cloud Storage, sharing and consent windows and the switch-to-local dialog. One capture-phase `document` listener serves all open modals, closes only the innermost (the last opened) and calls `preventDefault` + `stopPropagation`, so one Escape closes one window and never reaches the import preview's bubble-phase listener. Not one capture listener per modal: two listeners on the same node both run, so nested windows would close together. A modal that stays mounted while closed passes `active` false. A modal that makes the page `inert` returns focus in its close cleanup, after `inert` is removed: a `focus()` from a submit or cancel handler does nothing while the page is inert
- **Version constant** `APP_VERSION` in `constants.ts` — used by footer and migration system
- **CFD band order**: Done on bottom, Backlog on top (bands rise as work flows through)

## App Frame (v0.22.0, FRAME26)

CFD wears the SPERT® Suite app frame: one compact two-row frame on every screen of every SPERT® app, specified by
`spert-suite-docs/suite/frame/FRAME-CONTRACT.md` and drawn by `spert-frame.css`, vendored byte for byte into
`src/styles/` (md5 pinned by `src/styles/__tests__/frame-stylesheet.test.ts`; never edit the copy, re-vendor a new
canonical version). `globals.css` imports it once, unlayered, so an `sf-` property beats every Tailwind utility on the
same element. The live conformance check is `frame-check` (`spert-suite-docs/tooling/frame-check`, `--app cfd`).

- **The shell** (`app-shell.tsx`) is held by the root layout around every route, so it never remounts between `/` and
  `/changelog`: the tab travels in state, never in the URL. On `/` `main` shows the active tab; elsewhere it shows the
  route's page and no navigation item is active. An item or the brand chosen off `/` sets the tab, then `router.push('/')`.
- **The rows:** a skip link; the 56 px brand row (`app-header.tsx`: the brand link, the tagline, the theme button, the
  account chip); the 44 px navigation row (`tab-navigation.tsx`: Projects · CFD, then Settings · About · Help Center ↗);
  the notices slot (invitation, terms, local-storage caution, cloud-load caution); `main`; the 69 px footer. One 1600 px
  column with 32 px gutters. Every element carries its `data-sf` hook.
- **The body:** every screen has one heading row (`heading-row.tsx`), the page's only `h1`: "Projects" (with the toolbar's
  four 36 px `.sf-btn` buttons), the CFD tab's loaded project name (else "CFD"; one line, ellipsis, full name in `title`),
  "Settings", "About SPERT® CFD", "Changelog", "Page not found". The Projects tab is block flow so the frame's margins are
  the gaps: the one filter row (`data-sf="filters"`: "Show archived (N)" and O54's line, 16 px below the heading row), then
  the grid (`.sf-tiles`, 340 px minimum columns, 16 px gaps); the welcome panel and the all-archived line carry
  `data-sf="empty"`, 24 px below.
- **Exceptions:** the CFD tab is X1, the fitted working view (`.sf-main--fit`, DASH26 R18): its bordered panel fills the
  window between the heading row and the footer, and its sidebar and content scroll inside (the content is a
  `<div data-cfd-content>`, not a second `main`). Settings, About and the changelog are X4, capped at 896 px with the
  heading row full width (the changelog's own 672 px measure sits on an inner element). Every other screen scrolls the
  document; until v0.22.0 the whole app was a window-tall box whose tabs scrolled inside it.
- **Loading** (contract §7): the frame renders first in both loading states, the storage gate (`StorageProvider`'s
  `fallback`) and the project list; the body shows the tab's heading row and "Loading...", the notices wait for the
  load, and the account chip is `aria-disabled` until Cloud Storage can open.
- **Not framed:** the app-wide crash screen (the outer `ErrorBoundary`), which catches a failure of the frame itself.

## Dark Mode (v0.20.0: the header switch, the follow-your-computer default)

- **The variant.** `globals.css` declares `@custom-variant dark { @media not print { &:is(.dark *) { @slot; } } }`: a `dark:` class
  applies only under an element carrying the `dark` class (never from the operating system's setting) and never in print, so a page
  printed in dark comes out light. `&:is(.dark *)` needs an ancestor, so it never matches `<html>` itself.
- **The preference** (v0.20.0, DASH26 RD2): `spert-theme` in localStorage, `light`, `dark` or `system`, System the default. **One
  rule** (O33): anything but those three values (missing, invalid, unreadable) means System, and System follows the computer
  (`prefers-color-scheme`). Dark means the `dark` class on `<html>`. `src/lib/theme.ts` holds the rule and the store; two places
  apply it, the pre-paint script and `ThemeSync`, and one control writes it, the header's switch.
- **The pre-paint script.** `layout.tsx` writes `THEME_SCRIPT` (built in `theme.ts` from its own key and values) into `<head>`, so the
  class is on `<html>` before the first frame: a dark visitor never sees a light page first. It reads storage inside a `try` (the
  `window.localStorage` getter included: Chrome with site data blocked throws from the getter itself) and falls back to System
  outside it; SPERT® Forecaster's form, `stored || 'system'` inside one `try`, gives light for an invalid value or a throw.
  `theme-script.test.ts` runs the script's own text in a fresh JavaScript context for every stored value against both settings of
  the computer and checks the store gives the same answers. `<html>` carries `suppressHydrationWarning` (its own attributes only),
  since the class is there before React hydrates it.
- **The CSP has neither `script-src` nor `default-src`** (`next.config.ts:26–35`), which is why inline scripts run: this one, and
  Next's own (`self.__next_f.push(…)`, which carry the page to the browser). Measured on v0.20.0's production build with a second
  CSP header added (PR #111 review -01, `rev-pr111/opus-pr111-1-work/t04-csp.out`): `script-src 'self' 'sha256-<this script>'`
  runs this script but refuses Next's, and CFD stays on "Loading..." for every visitor; adding `'unsafe-inline'` beside the hash
  changes nothing, since a hash makes the browser ignore `'unsafe-inline'`; `script-src 'self'` refuses both, the same result;
  `'unsafe-inline'` with no hash or nonce runs both. So adding either directive needs one of two things: a nonce-based policy
  whose nonce also reaches this script (not measured), or `'unsafe-inline'` with no hash or nonce. A hash alone, or a hash beside
  `'unsafe-inline'`, stops CFD starting.
- **The store** (`theme.ts`). The preference lives in memory once read (O33 as amended): read from storage once per page, changed
  by every click whether or not the save succeeds, and by `storage` events from CFD's other tabs (using the event's own
  `newValue`). The switch shows it and `ThemeSync` applies it, so they always agree. This is the one piece of theme state in
  JavaScript, the preference itself (O26).
- **`ThemeSync`** (`theme-sync.tsx`), mounted once in the root layout's `<body>`, outside `AppShell`. It applies the preference
  when it mounts (a layout effect, before the browser paints) and follows the computer while System and the other tabs, on every
  route: on `/changelog`, on the loading screen, during a storage switch and on the crash screen, where the header and its switch
  are not mounted. A page restored from the back/forward cache (PR #111 review -02): Firefox drops the `storage` events that
  fire while a page is cached, so `ThemeSync` reads the stored value at `pagehide` and again at a persisted `pageshow`; if it
  changed, it is taken as that event would have been, and either way the class is applied again (the computer may have changed
  too). With nothing stored meanwhile, the tab's own choice stands, even one its save refused. It renders nothing and never
  writes. **Why it exists:** React removes every attribute of `<html>`, the class
  included, whenever it renders the root on the client instead of hydrating it (an error while hydrating: with storage blocked,
  `StorageProvider` throws); `ThemeSync` mounts again in that same commit and puts the class back. **It must never throw:** it
  sits outside every error boundary, and a throw there would replace all of CFD with Next's global error page; every storage
  access in `theme.ts` is guarded.
- **The switch** (`theme-toggle.tsx`, `HeaderThemeToggle`): SPERT® Forecaster's, before the sign-in chip. Sun / moon /
  monitor, 32 px, System → Light → Dark → System (R33), Forecaster's `aria-label` ("Theme: System. Switch to Light") and `title`,
  `type="button"`. Since v0.22.0 it is the frame's `.sf-theme`: its icons draw in `currentColor`, the frame's muted colour at rest
  and its text colour on hover, at full opacity (they carry state; v0.20.0's coloured icons at 70 % opacity, O39, went with it). It reads the store with `useSyncExternalStore`, so
  its first rendered frame already shows the stored preference: the header mounts after the loading screen, on the client, never
  in a server render. The server snapshot's placeholder (a 32 px grey square with its dark partner) is therefore unreachable on
  today's tree; `theme-toggle.test.tsx` renders it on the server and compiles its classes. Each click is announced in a polite
  `sr-only` status line ("Theme: Dark", "Theme: System (dark)"), CFD's own pattern (O38). It is the first Tab stop, before "Sign in".
- **A refused save** (O34, O35). With storage full or blocked, a click still changes the page, the icon, the label and the
  announcement; nothing is thrown and no message is shown. The choice is only not remembered: this tab's next reload reverts to
  the stored value, and CFD's other tabs, which hear of a change only through a successful save's `storage` event, keep their
  theme.
- **Known residuals** (O40). With the whole of storage blocked, `/` shows the pre-existing crash screen ("Something went wrong")
  before any switch, now in the visitor's theme; in development it logs React's "Encountered a script tag…" (React cannot run an
  inline script it renders on the client, and says so). Until v0.22.0 Next's built-in 404 page followed the computer, not the choice; since then CFD
  has its own `not-found.tsx` inside the frame. Colour
  transitions animate the flip where an element has one (Tailwind's 150 ms; the tab buttons 200 ms), as in Forecaster.
- **CSS only, no theme state in JavaScript but the preference.** Everything that changes with the theme follows the class through CSS:
  - Tailwind `dark:` classes beside every light colour, hover and focus colour (the values: SPERT® Forecaster's for shared elements,
    its palette for CFD's own; the page `#101828`, raised surfaces `#1e2939`, inputs `#364153`);
  - `html.dark { color-scheme: dark }` (plain CSS, since the variant cannot reach `<html>`) for scrollbars, select lists, the date
    picker and spinners; the body carries explicit text and background colours in both themes (`text-black` = the browser default);
  - the chart: recharts draws its axes and the Brush's background as SVG attributes, overridden by rules on recharts' class names in
    `globals.css` (`.recharts-brush > rect:first-of-type` depends on recharts' DOM order); its tooltip box is an inline style,
    overridden by `dark:!` classes through `wrapperClassName`; the workflow colours are drawn as chosen in both themes;
  - the header logo is two `<img>`s, since v0.22.0 the frame's `.sf-icon--light` / `.sf-icon--dark` (keyed on `:root.dark`,
    `alt=""` inside the brand link); the browser tab's icon does not change. The
    hidden one is still downloaded on a light visit (`spert-favicon-cfd-dark.png`, about 4 KB, one request): accepted
    (PR #110 review -07), since it lets CSS alone choose the logo, with no script knowing the theme;
  - the browser's own focus ring (`outline: auto`, which Chromium draws in #101010 whatever the colour scheme) takes the dark
    focus blue `#60a5fa` through one `@layer base` rule on `:where(.dark) *`, below every authored outline colour;
  - the header's title (v0.20.1, DASH26 RT, from the suite's HDR26): each word a gradient in CFD's favicon purple,
    `#9468fd` → `#6117c5` on the light page (`#ffffff`, weakest 3.71:1) and `#aa8fff` → `#783de3` on the dark one
    (`#101828`, weakest 3.02:1). Since v0.22.0 (FRAME26) the frame's `.sf-grad` draws each word from `--app-grad-light` /
    `--app-grad-dark` in `globals.css` (`linear-gradient(to right in oklab, …)`, the same ramps v0.20.1's
    `bg-gradient-to-r` drew), at the frame's 24 px bold; the title is the brand link's text, no longer an `<h1>`. Its
    fallbacks are the frame's: solid `--sf-heading` (`#333333` / `#e2e8f0`) under `prefers-contrast: more`, black in print.
- **Test files are not scanned for classes** (`@source not "../**/__tests__"` in `globals.css`): strings in a test, such as a
  guard's fixtures, would otherwise become utilities in the shipped CSS.
- **Guards.** `dark-partners.test.ts` fails when a class string carries a light colour utility (rest, hover, focus…) with no `dark:`
  partner of the same property and variants, unless the colour is on its short allowlist of colours kept in both themes,
  and when a one-side rule (`border-b`, `border-b-2`, `divide-y`) carries no colour at all. Its doc comment lists what it
  cannot see (inline and JavaScript colours, inherited ones, bare all-sides `border` / `ring-N` / `outline-N`). From v0.20.1
  (DASH26 O47) a colour whose variant chain is exactly `print:` needs no partner, since `dark:` never applies in print (the
  same file compiles `globals.css` to prove it), and a token carrying both `dark` and `print` is refused, a rule that never
  applies (a `contrast-more:` colour still needs its partner). `title-gradient.test.tsx` (v0.20.1; re-pinned on purpose
  at v0.22.0, FRAME26, for the frame) guards the header's title:
  - exactly two `.sf-grad` words, "SPERT" and "CFD", in `[data-sf=title]`, the space the title's own text, the brand
    named "SPERT® CFD" and no heading in the header;
  - the two ramps in `globals.css`, one declaration each, equal to the four pinned ends, and `.sf-grad` drawing them;
  - the ground premise, `--sf-page` `#ffffff` / `#101828`, read from the vendored stylesheet, painted by `.sf-app` and
    `.sf-bar`; the title 700 / 24 px there, so large text;
  - every one of 41 points of each ramp at 3:1 or more on its ground, in Oklab and in sRGB, the weakest pinned (3.71 / 3.02);
  - the frame's contrast-more and print fallbacks, and `--sf-heading` on both grounds;
  - no fade, filter, blend, text colour or ground from `<body>` through the brand link, and no rule in `globals.css`
    selecting the title.

  It does not see a style sheet set from script, or every way a class could move or shrink the title out of sight (a
  transform, a zero height, a clip); frame-check measures the rendered title.

  `globals-css.test.ts` compiles `globals.css` with the app's Tailwind and checks the variant, the print exclusion, `color-scheme`
  and the chart rules, the focus-ring rule and the test-file exclusion. The theme itself (v0.20.0): `theme-script.test.ts` (the
  script's own text against the store, every stored value × both computers), `theme-store.test.ts`, `theme-sync.test.tsx` and
  `theme-toggle.test.tsx`; jsdom files get a controllable `matchMedia` from `src/__tests__/setup-match-media.ts` (vitest
  `setupFiles`), never a fallback in the store.

## Test Tiers

| Tier | Where | Runs with | Sees |
|---|---|---|---|
| Unit and provider | `src/**/__tests__/` | `npm test` (Java-free, a few seconds) | logic, the contexts over the real local driver, and the cloud driver over a **mocked** Firestore SDK |
| Emulator (QC26 Q03) | `emulator-tests/` | `npm run test:emulator`, and as a ship-gate step | the **real** `createFirestoreDriver`, the real SDK and the real contexts against the Firestore emulator, under the **deployed** rules |

**Why the emulator tier exists.** 517 green unit tests shipped two defects (fixed in v0.15.19 and v0.15.20). A mocked SDK has behaviour the real one lacks: in `firestore-driver.test.ts` a client's own write can come back to its own listener, and the real SDK never delivers it (`emulator-tests/sdk-facts.test.ts` pins this). And no unit test runs against the security rules, where the v0.15.19 defect lived.

**The rules are pinned.** `emulator-tests/rules-pin.json` names the landing-page repo, a commit, the path and an md5. `scripts/run-emulator-tests.mjs` fetches the file at that commit, checks the md5 and caches it by md5 under `node_modules/.cache/spert-cfd-emulator`. `emulator-tests/global-setup.ts` checks the md5 again and PUTs those exact bytes into the emulator (an emulator given no rules allows everything). It prints the commit and md5, and writes them to the GitHub step summary in CI. `controls.test.ts` proves the rules are in force: a read that must be denied is denied, and one that must be allowed is allowed.

**Whether the pin is still current** is a separate job. `scripts/check-rules-pin.mjs`, run by `.github/workflows/rules-pin.yml` (daily, on PRs, on demand), compares the pin with the landing page's `main`, which is what production enforces. It is never a required check, so a landing-page rules change shows as a red X on CFD without blocking a release. To bump the pin, change `commit` and `md5` together, in a PR of its own; its ship gate then runs the tier against the new rules.

**Requirements.** A JDK 21+: CI uses the runner's `JAVA_HOME_21_X64`; on macOS, Homebrew `openjdk`. The network on the first run. `firebase-tools`, an exact devDependency. With none of these the launcher exits non-zero; it never skips. The emulator uses the demo project id `demo-spert-cfd`, so nothing can reach a real Firebase service. It listens on port 8180 (+1 to +3), or `SPERT_EMULATOR_PORT`.

**Limits.** No Auth emulator: tests sign in through the emulator's mock token, and the provider tests hand the real contexts their driver in place of `StorageProvider`. The emulator's timing is not production's. Tests for open defects are not here: each arrives with its fix.

## Scripts

```bash
npm run dev            # Start dev server
npm run build          # Production build
npm test               # Run tests once (vitest run)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run test:emulator  # Emulator tier (needs a JDK 21+; see Test Tiers)
npm run lint           # ESLint
```

## Known Optimizations / Backlog

### Drop per-project hydration in `projects-tab` (post-v0.11.0 follow-up; half done in v0.18.0)

`src/components/projects-tab.tsx` calls `driver.loadProject(id)` for every project in a `useEffect` to compute `ProjectStats`: an N+1 read pattern.

- **Done in v0.18.0 (DASH26 R1a):** access no longer comes from it. Cloud `ProjectListItem`s carry `owner`, this user's `role` and `memberCount` (`toListItem` in `firestore-driver.ts`, at both list read sites), and `tile-access.ts` derives the badges, Share and the Delete and Edit gates from the list item alone, in cloud mode only. The v0.10.2 Share-button rule (commit `4c250e2`) holds: Share needs cloud mode AND an explicit `owner` role, and the modal-side `isOwner` check in `sharing-modal.tsx` stays as a second line of defense.
- **Still to do:** the tile's meta lines (the snapshot and state counts, and the latest snapshot's date, DASH26 R7) need the snapshots and the workflow, which the list does not carry. Dropping the loop needs those counts and that date on the list item (cloud: on the document, kept current by every save).

Estimated impact: one Firestore read per project on the Projects tab mount and on every list change. Meaningful for users with 20+ projects or on slow connections.
