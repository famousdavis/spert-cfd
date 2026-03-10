// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';

export const metadata = {
  title: 'Changelog — CFD Laboratory',
};

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to CFD Laboratory
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Changelog</h1>
      </header>

      <section className="space-y-6">
        <article>
          <h2 className="text-lg font-semibold text-gray-900">
            v0.3.1
            <span className="ml-2 text-sm font-normal text-gray-500">
              Copyright Attribution
            </span>
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Added copyright headers to all human-authored source files and root config files</li>
            <li>Updated LICENSE with author attribution block and GPL v3 Section 7 additional terms</li>
            <li>Added Copyright &amp; Attribution Standing Instructions to CLAUDE.md</li>
          </ul>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-gray-900">
            v0.3.0
            <span className="ml-2 text-sm font-normal text-gray-500">
              Security &amp; Stability
            </span>
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Added file size limits (1MB) for CSV and JSON imports</li>
            <li>Added length limits for project and workflow state names</li>
            <li>Improved export filename sanitization</li>
            <li>Added Error Boundary for graceful error recovery</li>
            <li>Fixed data integrity issues with rapid project operations</li>
            <li>Fixed &quot;Last N days&quot; metrics filter to be relative to data, not current date</li>
            <li>Fixed project data versioning for future migrations</li>
            <li>Replaced browser alert/confirm dialogs with custom modals</li>
            <li>Performance optimizations for workflow sorting and storage checks</li>
            <li>Added comprehensive tests for date utilities</li>
          </ul>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-gray-900">
            v0.2.0
            <span className="ml-2 text-sm font-normal text-gray-500">
              Dependency Upgrades
            </span>
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Upgraded to Next.js 16.1.6 and React 19.2.4</li>
            <li>Migrated to Tailwind CSS v4 with CSS-based configuration</li>
            <li>Migrated to ESLint 9 with flat config</li>
            <li>Upgraded Vitest to v4, date-fns to v4, Recharts to v3</li>
            <li>Updated all remaining dependencies to latest stable versions</li>
            <li>Resolved all npm audit vulnerabilities (0 remaining)</li>
          </ul>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-gray-900">
            v0.1.0
            <span className="ml-2 text-sm font-normal text-gray-500">
              Initial Release
            </span>
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Multi-project support with localStorage persistence</li>
            <li>Customizable workflow states with drag-to-reorder, color picker, and category assignment (backlog/active/done)</li>
            <li>WIP limits on active states with visual warnings</li>
            <li>Editable data grid with keyboard navigation (arrow keys, Tab, Enter, Escape)</li>
            <li>Add snapshots with carry-forward from previous day</li>
            <li>CSV export and import with auto-column-mapping</li>
            <li>Stacked area CFD chart with brush zoom and toggleable legend</li>
            <li>Flow metrics panel: WIP, throughput, arrival rate, and average lead time (Little&apos;s Law)</li>
            <li>Configurable metrics period (all data, last N days, or custom date range)</li>
            <li>Project export/import as JSON</li>
            <li>Sample project with demo data on first visit</li>
            <li>Data migration framework for future upgrades</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
