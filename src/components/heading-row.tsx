// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ReactNode } from 'react';

interface HeadingRowProps {
  /** The page's one `h1`. */
  children: ReactNode;
  /** The full text, for a heading that may be ellipsised (a project's name, contract §7 "Long names"). */
  title?: string;
  /** The row's toolbar, flush right (the Projects tab's four buttons). */
  toolbar?: ReactNode;
}

/**
 * The frame's heading row (FRAME26, contract §3, v0.22.0): the page's `h1`,
 * 24 / 32 / 700 at the column's left edge, one line with an ellipsis, with the
 * toolbar flush right, 24 px under the frame. Every screen has exactly one, and
 * it is the page's only `h1`: the brand title in the header is not a heading.
 *
 * ⚠️ On a capped screen (`.sf-main--capped`, exception X4: Settings, About,
 * the changelog) render it as a DIRECT child of `main`, never inside a
 * wrapper: the stylesheet caps every child of `main` except this row, which
 * stays full width.
 */
export function HeadingRow({ children, title, toolbar }: HeadingRowProps) {
  return (
    <div className="sf-headrow" data-sf="headrow">
      <h1 className="sf-heading" data-sf="heading" title={title}>
        {children}
      </h1>
      {toolbar}
    </div>
  );
}
