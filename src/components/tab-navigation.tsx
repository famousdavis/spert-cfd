// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { HELP_CENTER_URL } from '@/lib/constants';
import { PAGE_COLUMN } from './page-column';

export type TabId = 'projects' | 'cfd' | 'settings' | 'about';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'cfd', label: 'CFD' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    // The rule under the tabs spans the page's column, not the window.
    <nav className={PAGE_COLUMN}>
      <div className="flex gap-1 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={
              activeTab === tab.id
                ? 'rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white'
                : 'rounded-full px-4 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100'
            }
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
        {/* Help Center (v0.17.8): a LINK that leaves the app, never a tab. So
            it is not in TABS, not a <button>, has no pill and no aria-current.
            It sits after About at the bar's right-hand end, in the inactive
            tabs' grey, underlined on hover. The arrow is hidden from assistive
            technology and the sr-only text completes the accessible name,
            "Help Center (opens in a new tab)". ⚠️ The spaces are their own text
            nodes, outside the spans: a space inside a span is trimmed by the
            accessible-name computation, giving "Help Center(opens in a new tab)". */}
        <a
          href={HELP_CENTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto self-center whitespace-nowrap text-sm font-medium text-gray-600 underline-offset-2 hover:underline"
        >
          Help Center{' '}<span aria-hidden="true">↗</span>{' '}<span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </nav>
  );
}
