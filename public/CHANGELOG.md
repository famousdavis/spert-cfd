# Changelog

All notable changes to SPERT® CFD are documented here.

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
