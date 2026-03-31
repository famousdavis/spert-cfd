// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { Footer } from '@/components/footer';

export const metadata = {
  title: 'Changelog — SPERT® CFD',
};

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to SPERT&reg; CFD
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Changelog</h1>
      </header>

      <section className="space-y-6">
        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.6
              <span className="ml-2 text-sm font-normal text-gray-500">
                Legal &amp; Branding Update
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 31, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Updated Terms of Service and Privacy Policy to v03-31-2026</li>
            <li>Updated canonical legal document URLs to spertsuite.com</li>
            <li>Updated consent UI text to SPERT&reg; Suite branding</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.5
              <span className="ml-2 text-sm font-normal text-gray-500">
                Legal Document Update
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 20, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Updated Terms of Service and Privacy Policy (effective March 20, 2026)</li>
            <li>Replaced reference copies in /legal directory</li>
            <li>Bumped TOS_VERSION to 03-20-2026 (triggers re-consent for returning Cloud Storage users)</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.4
              <span className="ml-2 text-sm font-normal text-gray-500">
                First-Run Banner Update
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 16, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Revised first-run notification text to include browsewrap consent language</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.3
              <span className="ml-2 text-sm font-normal text-gray-500">
                Node 22 LTS Pinning
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 11, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Added engines field to package.json requiring Node &gt;=22</li>
            <li>Created .nvmrc pinned to Node 22 for developer tooling and Vercel deployment</li>
            <li>Aligned @types/node to ^22 to match target runtime</li>
            <li>All dependencies verified compatible with Node 22 LTS (140 tests, clean build)</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.2
              <span className="ml-2 text-sm font-normal text-gray-500">
                Security Hardening
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 11, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Added security headers: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy, and Content-Security-Policy</li>
            <li>Disabled X-Powered-By header to prevent framework fingerprinting</li>
            <li>Removed dead next.config.mjs (next.config.ts takes precedence)</li>
            <li>Enforced MAX_NAME_LENGTH (200) on project create, project rename, and workflow state rename</li>
            <li>Added maxLength attribute to all project and workflow state name inputs</li>
            <li>Added hex color format validation (#RRGGBB) in validateProjectData for imported projects</li>
            <li>Added color validation test cases (140 total tests across 10 files)</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.1
              <span className="ml-2 text-sm font-normal text-gray-500">
                Maintenance &amp; Bug Fixes
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 11, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Fixed data loss when navigating away during debounced save window (flush pending save on unmount)</li>
            <li>Fixed Cloud Storage dropdown not closing on outside click (added useClickOutside dismiss handler)</li>
            <li>Fixed workflow state name validation allowing empty names on import</li>
            <li>Added memoization for sortedSnapshots in DataGrid and importResult in CsvImportModal</li>
            <li>Extracted shared download utility (sanitizeFilename, downloadFile) to reduce duplication</li>
            <li>Improved Firebase type safety: removed unsafe null casts, added proper null guards</li>
            <li>Updated lucide-react to 0.577.0, recharts to 3.8.0, and other minor dependency updates</li>
            <li>Added download utility test suite (136 total tests across 10 files)</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.4.0
              <span className="ml-2 text-sm font-normal text-gray-500">
                ToS &amp; Privacy Consent
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 11, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Added persistent footer links to Terms of Service and Privacy Policy on all pages</li>
            <li>Added first-run informational banner for new visitors</li>
            <li>Added clickwrap consent modal for Cloud Storage enablement</li>
            <li>Added Firebase Authentication integration (Google and Microsoft sign-in)</li>
            <li>Added Firestore consent record with read-before-write and version checking</li>
            <li>Added returning-user ToS version check with automatic sign-out on mismatch</li>
            <li>Added reference copies of legal documents in /legal directory</li>
            <li>Added consent utility test suite (126 total tests across 9 files)</li>
            <li>Graceful local-only mode when Firebase env vars are absent</li>
            <li>Synced package.json version with APP_VERSION constant</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.3.2
              <span className="ml-2 text-sm font-normal text-gray-500">
                App Rebrand
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 10, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Rebranded from CFD Laboratory to SPERT&reg; CFD across UI, metadata, and documentation</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.3.1
              <span className="ml-2 text-sm font-normal text-gray-500">
                Copyright Attribution
              </span>
            </h2>
            <span className="text-sm text-gray-400">March 10, 2026</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Added copyright headers to all human-authored source files and root config files</li>
            <li>Updated LICENSE with author attribution block and GPL v3 Section 7 additional terms</li>
            <li>Added Copyright &amp; Attribution Standing Instructions to CLAUDE.md</li>
          </ul>
        </article>

        <article>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.3.0
              <span className="ml-2 text-sm font-normal text-gray-500">
                Security &amp; Stability
              </span>
            </h2>
            <span className="text-sm text-gray-400">February 3, 2026</span>
          </div>
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
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.2.0
              <span className="ml-2 text-sm font-normal text-gray-500">
                Dependency Upgrades
              </span>
            </h2>
            <span className="text-sm text-gray-400">February 2, 2026</span>
          </div>
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
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              v0.1.0
              <span className="ml-2 text-sm font-normal text-gray-500">
                Initial Release
              </span>
            </h2>
            <span className="text-sm text-gray-400">January 31, 2026</span>
          </div>
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

      <div className="mt-12">
        <Footer />
      </div>
    </div>
  );
}
