// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { HELP_CENTER_URL } from '@/lib/constants';

export type TabId = 'projects' | 'cfd' | 'settings' | 'about';

interface Tab {
  id: TabId;
  label: string;
}

// The navigation row's two zones (FRAME26, contract §3 "Navigation zones",
// v0.22.0), in row order. The DOM order, and so the tab order, is the same as
// before the frame: Projects, CFD, Settings, About, Help Center.
// - WORK_TABS, on the left: the collection first ("Projects"), then the CFD tab.
// - APP_TABS, on the right: Settings · About, always in that order, then the
//   Help Center link.
const WORK_TABS: readonly Tab[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'cfd', label: 'CFD' },
];
const APP_TABS: readonly Tab[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
];

interface TabNavigationProps {
  /** The tab shown, or null on a screen no item leads to (the changelog, a 404): then no item is active. */
  activeTab: TabId | null;
  onTabChange: (tab: TabId) => void;
}

function TabButton({ tab, activeTab, onTabChange }: { tab: Tab } & TabNavigationProps) {
  return (
    <button
      type="button"
      onClick={() => onTabChange(tab.id)}
      // The active item is marked by `aria-current="page"` alone: the frame's
      // stylesheet draws its underline and accent colour from that attribute,
      // at the same weight as every other item, so nothing moves when the
      // selection changes (contract §3, "Active item"). `undefined`, never
      // "false", on the others: "false" is a value some assistive technology
      // announces. Not role="tab": that pattern promises a roving tabindex and
      // arrow keys, which these plain buttons do not have.
      aria-current={activeTab === tab.id ? 'page' : undefined}
      className="sf-tab"
    >
      {tab.label}
    </button>
  );
}

/**
 * The frame's navigation row (FRAME26, contract §3, v0.22.0): a full-width
 * 44 px band under the brand row, with a 1 px rule. v0.17.9's filled blue pill
 * on a 2 px rule went with v0.22.0; the active item is the frame's underline.
 */
export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="sf-nav" data-sf="nav">
      <div className="sf-col sf-nav-row">
        <div className="sf-nav-work" data-sf="nav-work">
          {WORK_TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={onTabChange} />
          ))}
        </div>
        <div className="sf-nav-app" data-sf="nav-app">
          {APP_TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={onTabChange} />
          ))}
          {/* Help Center (v0.17.8): a LINK that leaves the app, never a tab. So
              it is not in APP_TABS, not a <button>, and has no aria-current. It
              sits after About at the row's right-hand end, as the frame's quiet
              400-weight muted `.sf-help`, underlined on hover. The arrow is
              hidden from assistive technology and the sr-only text completes
              the accessible name, "Help Center (opens in a new tab)". ⚠️ The
              spaces are their own text nodes, outside the spans: a space inside
              a span is trimmed by the accessible-name computation, giving
              "Help Center(opens in a new tab)". */}
          <a href={HELP_CENTER_URL} target="_blank" rel="noopener noreferrer" className="sf-help">
            Help Center{' '}<span aria-hidden="true">↗</span>{' '}<span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
