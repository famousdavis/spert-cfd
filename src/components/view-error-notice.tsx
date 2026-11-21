// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * What an error boundary shows in place of a view it could not render
 * (v0.16.4). Its own module since v0.18.0, so the CFD tab's per-project
 * boundary (`project-dashboard.tsx`) and the tab's own (`app-shell.tsx`) share
 * one notice.
 */
export function ViewErrorNotice() {
  return (
    <div role="alert" className="mx-auto mt-8 max-w-xl rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-300">
      <p className="font-semibold">This view could not be displayed.</p>
      <p className="mt-1">Some of its data could not be shown. Other tabs and projects still work.</p>
    </div>
  );
}
