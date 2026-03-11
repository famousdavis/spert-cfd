# SPERT® CFD

A browser-only Cumulative Flow Diagram tool for agile teams. Part of the Statistical PERT® Software Suite. No server required — all data stays in your browser's localStorage.

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

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Recharts · Vitest · date-fns

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
