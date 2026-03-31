// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';
import { Footer } from '@/components/footer';

export const metadata = {
  title: 'Changelog — SPERT® CFD',
};

interface ChangelogEntry {
  version: string;
  subtitle: string;
  date: string;
  items: string[];
}

function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  for (const section of content.split(/\n(?=## )/)) {
    const lines = section.trim().split('\n');
    const match = lines[0].match(/^## (v[\d.]+)\s*[—–-]\s*(.+?)\s*\(([^)]+)\)$/);
    if (!match) continue;

    const [, version, subtitle, date] = match;
    const items = lines
      .slice(1)
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim());

    if (items.length > 0) {
      entries.push({ version, subtitle, date, items });
    }
  }

  return entries;
}

export default function ChangelogPage() {
  const content = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');
  const entries = parseChangelog(content);

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
        {entries.map((entry) => (
          <article key={entry.version}>
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {entry.version}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {entry.subtitle}
                </span>
              </h2>
              <span className="text-sm text-gray-400">{entry.date}</span>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {entry.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <div className="mt-12">
        <Footer />
      </div>
    </div>
  );
}
