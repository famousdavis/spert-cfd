// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// ─────────────────────────────────────────────────────────────────────────────
// PC-1 LAYERS 2 AND 3 (Brief 19).
//
// Layer 1 — the converter — is `mapDocToProject — updatedAt normalisation`
// in `src/lib/__tests__/firestore-driver.test.ts`.
//
// ⚠️ LAYER 2 IS WHERE THE FALLBACK IS ACTUALLY PROVED. Layer 1 alone would pass
// an implementation that normalises correctly and still renders wrongly — the
// em dash has to travel THROUGH `formattedDate` to reach the `Updated ${…}`
// template, and an implementation that lands it in the pre-existing falsy
// branch renders a bare dash with no "Updated", or a bare NBSP.
//
// The assertion is a specific expected string per shape, never "no throw":
// "no throw" is a subset predicate dressed as an equality, and a broken
// implementation satisfies it while rendering "Invalid Date".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import { ProjectCard, type ProjectStats } from '../project-row';
import type { Project } from '@/types';

const EXPECTED_ISO = '2026-08-23T12:00:00.000Z';
// Computed from the same instant rather than hardcoded, so the test is not
// timezone-fragile — but pinned to a shape below so it cannot silently become
// garbage and still "match".
const EXPECTED_DATE = format(new Date(EXPECTED_ISO), 'MMM d, yyyy');
const FALLBACK = '—'; // em dash
const NBSP = ' ';

function stats(updatedAt?: string): ProjectStats {
  return { snapshotCount: 0, workflowStateCount: 0, updatedAt };
}

function renderCard(s: ProjectStats | undefined) {
  return render(
    <ProjectCard
      id="p1"
      name="Project One"
      stats={s}
      isActive={false}
      onOpen={vi.fn()}
      onExport={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
    />,
  );
}

describe('project-row updatedAt rendering (PC-1 layer 2)', () => {
  it('the expected-date constant is a real formatted date, not a stray string', () => {
    // Guards the guard: if `format` ever returned something unexpected, every
    // assertion below would still "pass" against it.
    expect(EXPECTED_DATE).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2026$/);
  });

  it('renders "Updated <date>" when an instant is recoverable', () => {
    const { container } = renderCard(stats(EXPECTED_ISO));
    expect(screen.getByText(`Updated ${EXPECTED_DATE}`)).toBeTruthy();
    expect(container.textContent).not.toContain('Invalid Date');
    expect(container.textContent).not.toContain(FALLBACK);
  });

  it('renders "Updated —" when stats are present but no instant is recoverable', () => {
    // ⚠️ THE ROUTE IS THE ASSERTION. "Updated " must be present: the em dash
    // has to arrive through `formattedDate`, not through the falsy branch.
    const { container } = renderCard(stats(undefined));
    expect(screen.getByText(`Updated ${FALLBACK}`)).toBeTruthy();
    expect(container.textContent).not.toContain('Invalid Date');
    // And never a substituted current date.
    expect(container.textContent).not.toContain(
      format(new Date(), 'MMM d, yyyy'),
    );
  });

  it('renders a bare NBSP — NOT "Updated —" — when stats have not loaded', () => {
    // ⚠️ TWO DISTINCT NO-RENDER CASES, and this is the one PC-1's own shape
    // table cannot reach: it drives ProjectStats directly and never exercises
    // `stats == null`. Collapsing the two guards into one would claim "no
    // recorded update time" for a project whose stats are merely still
    // loading — a false claim about the data, and the same manufacture-meaning
    // move the sentinel ruling forbids.
    const { container } = renderCard(undefined);
    expect(container.textContent).not.toContain('Updated');
    expect(container.textContent).toContain(NBSP);
    expect(container.textContent).not.toContain(FALLBACK);
  });
});

describe('ProjectStats carries the converter output unchanged (PC-1 layer 3)', () => {
  // Hop 3 is a one-field copy inside a useEffect in `projects-tab.tsx:102`
  // (`updatedAt: full.updatedAt`). What can actually drift there is the TYPE
  // relation, and that is what broke: `ProjectStats.updatedAt` was `string`
  // while `Project.updatedAt` became `string | undefined`.
  //
  // ⚠️ This asserts the type relation, not the copy. A runtime assertion on
  // the copy itself would require mounting the whole tab, which buys nothing
  // the compiler does not already give.
  it('accepts exactly what Project.updatedAt produces, in both directions', () => {
    const fromProject: Project['updatedAt'] = undefined;
    const intoStats: ProjectStats['updatedAt'] = fromProject;
    const back: Project['updatedAt'] = intoStats;
    expect(back).toBeUndefined();

    const iso: Project['updatedAt'] = EXPECTED_ISO;
    const isoIntoStats: ProjectStats['updatedAt'] = iso;
    expect(isoIntoStats).toBe(EXPECTED_ISO);
  });
});
