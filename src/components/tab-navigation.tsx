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

// v0.17.9: the SPERT® suite's tab bar, as SPERT® Forecaster draws it
// (TabNavigation.tsx), itself matched to GanttApp: 37px tabs with 8px top
// corners over a 2px #eee rule, the active tab filled blue with a 3px border of
// the same blue, the others grey with a light grey hover. `leading-[normal]` is
// the CSS `normal` line-height (Tailwind's `leading-normal` is 1.5). The blue
// comes from globals.css's @theme block; Forecaster's other token colours are
// written here as hex (#666, #f5f5f5, #eee).
const TAB =
  'px-5 py-2 border-0 border-b-[3px] rounded-t-[8px] cursor-pointer font-semibold text-base leading-[normal] transition-all duration-200';
const TAB_ACTIVE = 'bg-spert-blue text-white border-b-spert-blue';
const TAB_INACTIVE = 'bg-transparent text-[#666] border-b-transparent hover:bg-[#f5f5f5]';

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    // The rule under the tabs spans the page's column, not the window.
    <nav className={PAGE_COLUMN}>
      <div className="flex gap-2 border-b-2 border-[#eee]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`${TAB} ${activeTab === tab.id ? TAB_ACTIVE : TAB_INACTIVE}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
        {/* Help Center (v0.17.8): a LINK that leaves the app, never a tab. So
            it is not in TABS, not a <button>, has none of the tabs' shape or
            fill, and no aria-current.
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
          className="ml-auto self-center whitespace-nowrap text-sm text-[#666] underline-offset-2 hover:underline"
        >
          Help Center{' '}<span aria-hidden="true">↗</span>{' '}<span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </nav>
  );
}
