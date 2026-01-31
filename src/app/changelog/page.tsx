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
