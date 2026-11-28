// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_VERSION, LICENSE_URL } from "@/lib/constants";
import { STABILITY_NOISE_SIGMAS, STABILITY_TOLERANCE } from "@/lib/calculations";
import { CopyrightYear } from "@/lib/copyright";

// The suite's About page (FRAME26 pass 3, contract §3 About page and §7 About;
// stylesheet v4's `.sf-about`). The page's `h1` "About SPERT® CFD" is the
// frame's heading row, rendered by AppShell above this; this element is
// `main`'s next child and carries its own 16 px gap and 672 px measure. Every
// word is §7's shared words, the approved words in FRAME26-ABOUT-WORDS.md, or
// (v0.25.0) the Help Center's guide title and description: change none without
// William's approval. No utility classes: the frame styles
// the page. Flow metrics is v0.23.0's text word for word, its two figures still
// computed from the constants the panel uses.

const tolerancePercent = Math.round(STABILITY_TOLERANCE * 100);
const REPO_URL = "https://github.com/famousdavis/spert-cfd";
// This app's Help Center page, compared as a literal by the tests.
const HELP_URL = "https://spertsuite.com/help/cfd";

/**
 * The Guides rows (contract §7 item 5, v0.25.0): one per guide in CFD's Help Center entry
 * (spert-landing-page `src/data/help.ts`, slug `cfd`), in its order, the title and description
 * VERBATIM from there (description approved by William, 2026-11-28). The PDF is served from this
 * origin (`public/`), so `static-assets.test.ts` holds the link. Change these only together with
 * help.ts: frame-check compares the two.
 */
const GUIDES = [
  {
    href: "/SPERT_CFD_Quick_Reference_Guide.pdf",
    title: "Quick Reference Guide",
    description:
      "What CFD is and how it turns your workflow’s daily item counts into a cumulative flow diagram and flow metrics such as WIP, throughput and lead time.",
  },
] as const;

const R = <span className="sf-mark">®</span>;
const TM = <span className="sf-mark sf-mark--tm">™</span>;

/** A link that opens in a new tab, as §7 marks it: the arrow hidden from screen readers, the warning read instead. */
function NewTab({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sf-sr"> (opens in a new tab)</span>
    </a>
  );
}

export function AboutTab() {
  return (
    <div className="sf-about" data-sf="about">
      <section>
        <h2>What is SPERT{R} CFD?</h2>
        <p>
          SPERT{R} CFD is a lightweight, browser-based tool for building and
          analyzing Cumulative Flow Diagrams. CFDs are a standard agile
          visualization that shows how work items flow through your process
          over time, making bottlenecks, WIP buildup, and throughput trends
          visible at a glance.
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <ol>
          <li>
            Create a project and define your workflow states (e.g., Backlog,
            In Dev, Done)
          </li>
          <li>
            Record daily or periodic snapshots of item counts in each state.
            Done counts are cumulative: each snapshot counts every item
            finished so far, without resetting at the end of a sprint.
          </li>
          <li>View the stacked-area CFD chart that updates as you add data</li>
          <li>
            Monitor flow metrics: WIP, throughput, start and arrival rates,
            and approximate cycle time and lead time
          </li>
          <li>Set WIP limits and get visual warnings when they are exceeded</li>
        </ol>
      </section>

      <section>
        <h2>Flow metrics</h2>
        <p>
          The metrics panel calculates Work in Progress (WIP), throughput
          (items completed per day), start rate (items starting work per
          day) and arrival rate (new requests entering the backlog per day).
          It estimates two times with Little&apos;s Law, each the
          period&apos;s average number of items &divide; its throughput:
        </p>
        <ul>
          <li>
            <strong>Cycle time</strong> runs from when work on an item
            first starts until it is done. It averages the items in your
            active states.
          </li>
          <li>
            <strong>Lead time</strong> runs from when a request enters the
            backlog until it is done, so it includes all the time the
            request sits in the backlog. It averages the items in your
            backlog and active states.
          </li>
        </ul>
        <p>
          The WIP card shows the period&apos;s average number of active
          items, the figure cycle time divides by throughput, with
          today&apos;s count beneath it. The lead time card notes its own
          average, of backlog and active items.
        </p>
        <p>
          Keep the Backlog to real requests. Little&apos;s Law assumes every
          item is eventually finished, so a long tail of ideas that will
          never be done inflates lead time. Rates come from the change in
          counts, so a request removed without being done cancels out a new
          one, and if more are removed than arrive, arrival rate shows 0.
        </p>
        <p>
          Both times assume a steady flow. When work starts more than{" "}
          {tolerancePercent}% faster or slower than it finishes, the panel
          warns that cycle time will understate or overstate how long new
          work takes; when requests arrive more than {tolerancePercent}%
          faster or slower than they finish, it warns the same of lead time.
          Because a few items either way is a large share of a small count,
          it also waits until the gap between the items that started (or
          arrived) and those that finished is more than{" "}
          {STABILITY_NOISE_SIGMAS} &times; the square root of their sum,
          wider than chance alone usually explains. If a Done count goes
          down, the panel warns you of that instead.
        </p>
        <p>
          Metrics can be filtered by time period: all data, or the last 7,
          14, 30 or 90 days. A project imported with another period, such as
          a custom date range, keeps it, and the panel names it.
        </p>
      </section>

      <section>
        <h2>Guides</h2>
        <ul className="sf-guides" data-sf="guides">
          {GUIDES.map((g) => (
            <li className="sf-guide" key={g.href}>
              <div className="sf-guide-body">
                <h3 className="sf-guide-title">{g.title}</h3>
                <p className="sf-guide-text">{g.description}</p>
              </div>
              <a className="sf-guide-open" href={g.href} target="_blank" rel="noopener noreferrer">
                Open PDF
                <span aria-hidden="true"> ↗</span>
                <span className="sf-sr">: {g.title} (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <p>
          <NewTab href={HELP_URL}>More help in the Help Center</NewTab>
        </p>
      </section>

      <section>
        <h2>Your data and storage</h2>
        <p>
          Unless you sign in and choose cloud storage, SPERT{R} CFD keeps your
          projects in this browser, on this device, and sends them to no
          server. Clearing this site&apos;s data deletes them, so export a
          backup from time to time.
        </p>
        <p>
          If you sign in, with Google or with a Microsoft work or school
          account, and choose cloud storage, your projects are saved to your
          account in Google Firebase, over encrypted (HTTPS) connections. You
          can then open them on any device and share them with other people.
        </p>
      </section>

      <section className="sf-about-legal" data-sf="about-legal">
        <h2>Version and license</h2>
        <p>
          Version {APP_VERSION} · <Link href="/changelog">What&apos;s new</Link>
        </p>
        <p>
          Created by William W. Davis, MSPM, PMP ·{" "}
          <NewTab href={REPO_URL}>Source code on GitHub</NewTab>
        </p>
        <p>
          © <CopyrightYear /> William W. Davis, MSPM, PMP. SPERT{R} CFD is free
          software: you may use, change and share it under the GNU General
          Public License, version 3, with the additional terms its{" "}
          <NewTab href={LICENSE_URL}>LICENSE</NewTab> adds under Section 7 of
          that license: attribution and legal notices, trademarks, the marking
          of modified versions, endorsement, and indemnification.
        </p>
        <p>
          SPERT{R}, Statistical PERT{R} and Estimation Made Easy{R} are
          registered trademarks of famousdavis, LLC. GanttApp{TM} and
          MyScrumBudget{TM} are trademarks of famousdavis, LLC.
        </p>
        <p>
          THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
          APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE
          COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM &quot;AS
          IS&quot; WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED,
          INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
          MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE
          RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.
          SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL
          NECESSARY SERVICING, REPAIR OR CORRECTION.
        </p>
      </section>
    </div>
  );
}
