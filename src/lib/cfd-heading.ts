// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { UNNAMED_PROJECT } from './cloud-load-guards';

/**
 * The CFD tab's `h1` (FRAME26 contract §7, "Inside a project", v0.22.0): the
 * name of the project the panel shows, which is the LOADED project
 * (`useActiveProject().project`), never the list's `activeProjectId`. During a
 * switch the panel keeps the previous project until the new one has loaded,
 * and the heading names what is shown (the same reason the panel's
 * per-project key is the loaded id, DASH26 PR #108 review -01). A project
 * with no name reads as UNNAMED_PROJECT, as in the picker. With no project
 * open, the heading is the tab's own name, "CFD".
 *
 * The heading is one line with an ellipsis (the frame's `.sf-heading`), so
 * the full name also goes in `title` (contract §7, "Long names").
 */
export function cfdHeading(project: { name?: string | null } | null | undefined): { text: string; title?: string } {
  if (!project) return { text: 'CFD' };
  const name = project.name || UNNAMED_PROJECT;
  return { text: name, title: name };
}
