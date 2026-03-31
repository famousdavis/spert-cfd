# SPERT® CFD

A Cumulative Flow Diagram tool for agile teams. Part of the SPERT® Suite. Core functionality runs entirely in the browser with localStorage persistence. Optional Cloud Storage uses Firebase for cross-device data sync.

## Features

- **Multi-project support** with localStorage persistence
- **Customizable workflow states** — drag-to-reorder, color picker, category assignment (backlog/active/done)
- **WIP limits** on active states with visual warnings
- **Editable data grid** with keyboard navigation (arrow keys, Tab, Enter, Escape)
- **Carry-forward** — new snapshots copy previous day's values
- **CSV export and import** with auto-column-mapping
- **Stacked area CFD chart** with brush zoom and toggleable legend
- **Flow metrics** — WIP, throughput, arrival rate, and average lead time (Little's Law)
- **Configurable metrics period** (all data, last N days, or custom date range)
- **Project export/import** as JSON
- **Data migration framework** for future upgrades
- **Optional Cloud Storage** with Firebase Auth (Google and Microsoft sign-in)
- **Terms of Service / Privacy Policy** consent flow for Cloud Storage users

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A sample project with demo data is created on first visit.

## Scripts

```bash
npm run dev            # Start dev server
npm run build          # Production build
npm test               # Run tests
npm run test:watch     # Tests in watch mode
npm run test:coverage  # Coverage report
npm run lint           # ESLint
```

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Recharts 3 · Firebase · Vitest 4 · date-fns 4

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Legal

Reference copies of the Terms of Service and Privacy Policy are in `/legal`. The canonical versions used by the app at runtime are hosted at:

- https://spertsuite.com/TOS.pdf
- https://spertsuite.com/PRIVACY.pdf

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
