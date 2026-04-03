// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

export type TabId = 'projects' | 'cfd' | 'about';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'cfd', label: 'CFD' },
  { id: 'about', label: 'About' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="border-b border-gray-200 bg-white px-4">
      <div className="mx-auto flex max-w-4xl gap-1 py-2">
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
      </div>
    </nav>
  );
}
