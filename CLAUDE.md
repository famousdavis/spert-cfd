# SPERT® CFD — Claude Code Context

## Identity

- **App**: SPERT® CFD (Cumulative Flow Diagram tool for agile teams)
- **Version**: 0.4.4 (`APP_VERSION` in `src/lib/constants.ts`)
- **Owner**: William W. Davis, MSPM, PMP
- **License**: GNU GPL v3
- **Repo**: https://github.com/famousdavis/spert-cfd

## Architecture Decisions

- **Split contexts**: `ProjectListContext` (list/switch) + `ActiveProjectContext` (data/saves with 300ms debounce) — isolates re-renders
- **Split localStorage**: Index at `cfd-lab`, projects at `cfd-lab-project-{id}`
- **SSR safety**: Deferred loading via `useEffect` + `isLoaded` flag — never read localStorage in `useState` initializer
- **Semver migrations**: `migrations.ts` with `compareVersions()`, auto-runs on `loadIndex()`/`loadProject()`
- **Discriminated unions**: Use `kind` (not `type`) — e.g. `MetricsPeriod`
- **CFD band order**: Done on bottom, Backlog on top (standard convention — bands rise)
- **Two-tier consent**: Browsewrap footer (all users) + clickwrap modal (Cloud Storage users)
- **Auth provider nesting**: `ErrorBoundary > AuthProvider > ProjectListProvider > ActiveProjectProvider`
- **Firebase shared project**: `spert-suite` shared across all six SPERT apps; env vars via `NEXT_PUBLIC_FIREBASE_*`

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants.ts` | `APP_VERSION` — single source of truth for version |
| `src/lib/dates.ts` | Date helpers + `sortSnapshots`, `sortWorkflow`, `mergeSnapshots`, `daySpanBetween` |
| `src/lib/use-dismiss.ts` | `useEscapeKey()`, `useClickOutside()` hooks |
| `src/lib/storage.ts` | localStorage CRUD with migration integration |
| `src/lib/migrations.ts` | Semver migration framework |
| `src/lib/calculations.ts` | Flow metrics (WIP, throughput, lead time via Little's Law) |
| `src/lib/download.ts` | `sanitizeFilename()`, `downloadFile()` — browser download utility |
| `src/types/index.ts` | All domain types |
| `src/components/footer.tsx` | Footer matching MyScrumBudget style |
| `src/components/error-boundary.tsx` | React Error Boundary for crash recovery |
| `src/components/confirm-dialog.tsx` | Custom confirmation modal (replaces browser `confirm()`) |
| `src/lib/firebase.ts` | Firebase app/auth/firestore initialization |
| `src/lib/consent.ts` | Consent localStorage helpers |
| `src/contexts/auth-context.tsx` | AuthProvider with onAuthStateChanged handler |
| `src/components/consent-modal.tsx` | Clickwrap consent modal for Cloud Storage |
| `src/components/first-run-banner.tsx` | First-run informational banner |

## Code Conventions

- IDs: `nanoid(8)`
- Sorting: Always use `sortSnapshots()` / `sortWorkflow()` from `dates.ts`, never inline `[...arr].sort()`
- Merging snapshots: Use `mergeSnapshots()` from `dates.ts`
- Dismiss patterns: Use `useEscapeKey()` / `useClickOutside()` from `use-dismiss.ts`
- Validation: `validateProjectData()` guards all loaded project data
- Footer: centered text — `© YYYY William W. Davis, MSPM, PMP | Version X.Y.Z | Licensed under GNU GPL v3` + legal links on second line

## Commands

```bash
npm run dev            # Dev server
npm run build          # Production build (also lints + type-checks)
npm test               # 140 tests across 10 files
npm run test:watch     # Watch mode
```

## Workflow

- **Feature branches** first, merge to `main` on owner approval
- Never push directly to `main` without approval
- Keep tests passing and build clean before committing

## ToS/Privacy Consent Architecture

Two-tier legal consent model:

1. **Browsewrap** (all users): Persistent footer links to ToS and Privacy Policy on every page. No action required.
2. **Clickwrap** (Cloud Storage users): Consent modal with checkbox shown before Firebase Auth fires. Requires explicit agreement.

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `spert_firstRun_seen` | First-run banner dismissed (`"true"`) |
| `spert_tos_accepted_version` | Cached ToS version accepted locally (`"03-11-2026"`) |
| `spert_tos_write_pending` | Flag set before Firebase Auth; consumed after Firestore write (`"true"`) |

### Firestore Path

`users/{uid}` — top-level document (NOT a subcollection). Fields: `acceptedAt`, `tosVersion`, `privacyPolicyVersion`, `appId`, `authProvider`.

### Firestore Security Rules

Managed centrally in the Firebase Console for the shared `spert-suite` project. The `users/{uid}` collection rule: `allow read, write: if isAuth() && request.auth.uid == uid` — each user can only read/write their own consent record. Verified during v0.4.2 security audit.

### Auth Providers

Exactly two: Google Sign-In and Microsoft Sign-In (Entra ID). Do not add others.

### Version String

`03-11-2026` — stored in `TOS_VERSION` constant. Used for both ToS and Privacy Policy version fields.

## Copyright & Attribution Standing Instructions

- Every new human-authored source file must include the copyright header using the appropriate comment syntax for its file type.
- Never remove or modify existing copyright headers.
- The LICENSE file attribution block and Section 7(b) non-permissive additional terms must not be altered.
- When creating test files, include the header.
- If a framework directive (`'use client'`, `'use server'`, shebang) is present, place the header above it.
- Root config files (`vitest.config.*`, `eslint.config.*`, `next.config.*`, `tailwind.config.*`, `postcss.config.*`, `firestore.rules`, etc.) get headers. Auto-generated files (`package-lock.json`, `next-env.d.ts`, `vite-env.d.ts`, lock files, framework output) do not.
- Files that do not support comments (`*.json`, `tsconfig.*`) do not get headers.

### Header Templates

**JS / TS / JSX / TSX / MJS / CJS:**
```
// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
```

**CSS:**
```
/* Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
   Licensed under the GNU General Public License v3.0.
   See LICENSE file in the project root for full license text. */
```

**HTML:**
```
<!-- Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
     Licensed under the GNU General Public License v3.0.
     See LICENSE file in the project root for full license text. -->
```
