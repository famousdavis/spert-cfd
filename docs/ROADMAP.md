<!-- Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
     Licensed under the GNU General Public License v3.0.
     See LICENSE file in the project root for full license text. -->

# SPERT® CFD: roadmap and deferred items

This file lists work that was found and deliberately **not** done, so it can be weighed later. It records findings, not
decisions: nothing here is scheduled until the owner says so. Add new items in the same shape:
- what it is;
- where it is;
- what was measured;
- why it waited;
- a suggested fix.

When an item ships, delete it here and say so in `CHANGELOG.md`.

---

## From FRAME26 (the SPERT® Suite frame)

These were found while CFD adopted the suite's shared app frame (v0.22.0, famousdavis/spert-cfd#116, 2026-11-26) and
left out of that release because they sat outside its scope. The evidence is in
`~/Developer/frame26-evidence/Frame-CFD/` (`STEP1-REPORT.md` to `STEP3-REPORT.md`).

Four of the five are already done, so they are not listed here:
- v0.23.0 locked the page behind open dialogs;
- v0.23.0 raised the two light-grey texts (the changelog's dates, the "Storage:" line) above 4.5 : 1;
- v0.23.0 kept the Projects heading on the page when the tiles fail;
- v0.23.0 settled the app-wide crash screen: it stays outside the frame on purpose (contract §7), restyled in the
  frame's colours, with one wording across the suite.

### `projects-tab.tsx` keeps its old indentation

- **What:** v0.22.0 removed the Projects tab's two wrapper `div`s (its own scroller and the page column) and kept the
  children's indentation, so the diff stayed readable. On `main` the body under `<div ref={rootRef}>` in
  `src/components/projects-tab.tsx` is indented one level deeper than its parent.
- **Why it waited:** whitespace only. Mixing it into the frame release would have hidden the real changes.
- **Status:** **fixed in famousdavis/spert-cfd#118** (v0.24.0, which splits the Projects tab along its seams and
  re-indents the root block). Delete this item when #118 merges. If #118 is closed instead, re-indent the return block
  in a commit of its own, with nothing else in it (`git diff -w` should be empty).
