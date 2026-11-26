// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'fs';
import { join } from 'path';
import { Fragment } from 'react';
import { HeadingRow } from '@/components/heading-row';
import { parseChangelog, splitBold } from '@/lib/parse-changelog';

export const metadata = {
  title: 'Changelog — SPERT® CFD',
};

/**
 * The changelog, reached from the footer's Version link. It renders inside the
 * SPERT® Suite frame, which the root layout holds (v0.22.0): the brand row, the
 * navigation (no item active: no item leads here), the notices and the footer
 * are the frame's. Until v0.22.0 it had its own small header ("← Back to
 * SPERT® CFD") and its own footer, and no frame; the brand and the navigation
 * replace that link. Its body is capped (X4) and the heading row is a direct
 * child of `main`, so it stays full width. The list keeps its 672 px measure on
 * an inner element, aligned at the column's edge.
 */
export default function ChangelogPage() {
  const content = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');
  const entries = parseChangelog(content);

  return (
    <>
      <HeadingRow>Changelog</HeadingRow>
      {/* The 672 px measure is on the inner element: X4 caps every child of
          main at 896 px, and its rule is unlayered, so it would beat a max-w-*
          on the child itself. */}
      <div className="sf-below">
        <section className="max-w-2xl space-y-6">
          {entries.map((entry) => (
            <article key={entry.version}>
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {entry.version}
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {entry.subtitle}
                  </span>
                </h2>
                <span className="text-sm text-gray-400">{entry.date}</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                {entry.items.map((item, i) => (
                  <li key={i}>
                    {splitBold(item).map((segment, j) =>
                      segment.bold ? (
                        <strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">
                          {segment.text}
                        </strong>
                      ) : (
                        <Fragment key={j}>{segment.text}</Fragment>
                      ),
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
