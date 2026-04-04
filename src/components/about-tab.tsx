// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { APP_VERSION } from '@/lib/constants';

function TrademarkedName({ name, bold = false }: { name: string; bold?: boolean }) {
  return (
    <span>
      {bold ? <strong>{name}</strong> : name}<span className="font-normal">&reg;</span>
    </span>
  );
}

export function AboutTab() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-[800px]">
        <h2 className="text-2xl mb-2 text-gray-900">
          About <TrademarkedName name="SPERT" /> CFD
        </h2>
        <p className="text-gray-500 italic mb-8">
          Cumulative Flow Diagrams for Agile Teams
        </p>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">
            What is <TrademarkedName name="SPERT" /> CFD?
          </h3>
          <p className="leading-relaxed text-gray-600">
            <TrademarkedName name="SPERT" /> CFD is a lightweight, browser-based tool for
            building and analyzing Cumulative Flow Diagrams. CFDs are a standard agile
            visualization that shows how work items flow through your process over time,
            making bottlenecks, WIP buildup, and throughput trends visible at a glance.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">How It Works</h3>
          <ul className="pl-8 leading-loose text-gray-600 list-disc">
            <li>Create a project and define your workflow states (e.g., Backlog, In Dev, Done)</li>
            <li>Record daily or periodic snapshots of item counts in each state</li>
            <li>View the stacked-area CFD chart that updates as you add data</li>
            <li>Monitor flow metrics: WIP, throughput, and approximate lead time</li>
            <li>Set WIP limits and get visual warnings when they are exceeded</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">Flow Metrics</h3>
          <p className="leading-relaxed text-gray-600">
            The metrics panel calculates Work in Progress (WIP), throughput (items completed
            per day), and approximate lead time using Little&apos;s Law (WIP &divide; Throughput).
            Metrics can be filtered by time period: all data, last N days, or a custom date range.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">Your Data &amp; Storage</h3>
          <p className="leading-relaxed text-gray-600 mb-4">
            <TrademarkedName name="SPERT" /> CFD supports two storage modes, configurable
            in the <strong>Settings</strong> tab.
          </p>

          <h4 className="text-lg mb-2 text-gray-900 font-semibold">Local Storage</h4>
          <ul className="pl-8 leading-loose text-gray-600 list-disc">
            <li>Data is stored in your browser&apos;s localStorage and <strong>never leaves your device</strong></li>
            <li>No external database servers, no third-party access, no data governance concerns</li>
            <li>Ideal for corporate/organizational environments where data must stay within your network</li>
            <li>Use <strong>Export</strong> to back up your data as a JSON file; use <strong>Import</strong> to restore or transfer between browsers</li>
            <li><strong>Note:</strong> Clearing your browser cache/data will delete all stored projects unless you&apos;ve exported a backup</li>
          </ul>

          <h4 className="text-lg mb-2 mt-4 text-gray-900 font-semibold">Cloud Storage</h4>
          <ul className="pl-8 leading-loose text-gray-600 list-disc">
            <li>Opt-in cloud sync via Google or Microsoft sign-in</li>
            <li>Data persists across devices and browser sessions</li>
            <li>Real-time sync: changes appear instantly in other open tabs</li>
            <li>Share projects with collaborators (editor or viewer access)</li>
            <li>Local projects can be uploaded to the cloud during setup</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">Author &amp; Source Code</h3>
          <p className="leading-relaxed text-gray-600 mb-2">
            Created by <strong>William W. Davis, MSPM, PMP</strong>
          </p>
          <a
            href="https://github.com/famousdavis/spert-cfd"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-blue-600 text-white no-underline rounded font-semibold mt-2 hover:bg-blue-700"
          >
            View Source Code on GitHub
          </a>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">Version</h3>
          <p className="leading-relaxed text-gray-600">v{APP_VERSION}</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">Trademark</h3>
          <p className="leading-relaxed text-gray-600">
            <TrademarkedName name="SPERT" /> and <TrademarkedName name="Statistical PERT" /> are
            registered trademarks with the United States Patent and Trademark Office.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">License</h3>
          <p className="leading-relaxed text-gray-600">
            This software is licensed under the GNU General Public License v3.0 (GPL-3.0).
            You are free to use, modify, and distribute this software under the terms of the
            GPL-3.0 license.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl mb-3 text-blue-600">No Warranty Disclaimer</h3>
          <p className="leading-relaxed text-gray-600">
            THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.
            EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES
            PROVIDE THE PROGRAM &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED
            OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
            AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND
            PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU
            ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.
          </p>
        </section>
      </div>
    </div>
  );
}
