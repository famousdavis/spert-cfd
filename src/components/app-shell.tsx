// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Suspense, useState, useCallback, useRef } from 'react';
import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context';
import { ActiveProjectProvider } from '@/contexts/active-project-context';
import { AuthProvider } from '@/contexts/auth-context';
import { StorageProvider } from '@/contexts/storage-context';
import { ErrorBoundary } from './error-boundary';
import { AppHeader } from './app-header';
import { TabNavigation, type TabId } from './tab-navigation';
import { ProjectsTab } from './projects-tab';
import { ProjectDashboard } from './project-dashboard';
import { FirstRunBanner } from './first-run-banner';
import { LocalStorageWarningBanner } from './local-storage-warning-banner';
import { CloudLoadNoticeBanner } from './cloud-load-notice-banner';
import { SettingsTab } from './settings-tab';
import { AboutTab } from './about-tab';
import { Footer } from './footer';
import { CloudStorageModal } from './cloud-storage-modal';
import { InvitationBanner } from './invitation-banner';
import { ViewErrorNotice } from './view-error-notice';

function AppContent() {
  const { isLoaded, switchProject } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabId>('projects');
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  // v0.18.0 (DASH26 O14): a tile's Open, or Load Sample, takes focus to the
  // CFD tab's project picker, which reads this once as it mounts. Without it
  // focus fell to <body>: the Projects tab unmounts under the focused button.
  const pickerFocusPending = useRef(false);
  const takePickerFocus = useCallback(() => {
    const pending = pickerFocusPending.current;
    pickerFocusPending.current = false;
    return pending;
  }, []);

  const handleOpenInCfd = useCallback(
    (id: string) => {
      pickerFocusPending.current = true;
      switchProject(id);
      setActiveTab('cfd');
    },
    [switchProject]
  );

  // Any other tab change drops a request the picker never took (it does not
  // mount when the CFD tab fails as a whole), so it cannot pull focus to the
  // picker on a later, unrelated visit (DASH26 PR #108 review, -07).
  const handleTabChange = useCallback((tab: TabId) => {
    pickerFocusPending.current = false;
    setActiveTab(tab);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <ActiveProjectProvider>
      {/* White, as in GanttApp: the header, the tabs, the notices and each
          tab share one column (see page-column.ts), with no full-width bars. */}
      <div className="flex h-screen flex-col bg-white">
        <AppHeader onOpenModal={() => setCloudModalOpen(true)} />
        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        {/* InvitationBanner uses next/navigation hooks (useSearchParams)
            which require a Suspense boundary in the App Router or
            `next build` will fail. Mounted above FirstRunBanner since
            it is claim-critical when present. */}
        <Suspense fallback={null}>
          <InvitationBanner />
        </Suspense>
        <FirstRunBanner />
        <LocalStorageWarningBanner />
        <CloudLoadNoticeBanner />
        <CloudStorageModal
          open={cloudModalOpen}
          onClose={() => setCloudModalOpen(false)}
        />
        <div className="flex flex-1 overflow-hidden">
          {/* v0.16.4: an error in one tab leaves the header, the tabs and
              sign-out up, so the user can move on. Keyed by the tab only:
              v0.17.0 stopped keying the Projects tab by the open project (a
              create makes the new project active at once, and the remount lost
              its "Couldn't create" alert and the New Project button's focus),
              and v0.18.0 moved the CFD tab's per-project key inside the tab,
              below its project picker (project-dashboard.tsx), so a switch made
              from the picker keeps the picker, its focus and its type-ahead. */}
          <ErrorBoundary key={activeTab} fallback={<ViewErrorNotice />}>
            {activeTab === 'projects' && (
              <ProjectsTab onOpenInCfd={handleOpenInCfd} />
            )}
            {activeTab === 'cfd' && (
              <ProjectDashboard
                onGoToProjects={() => handleTabChange('projects')}
                takePickerFocus={takePickerFocus}
              />
            )}
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'about' && <AboutTab />}
          </ErrorBoundary>
        </div>
        <Footer />
      </div>
    </ActiveProjectProvider>
  );
}

export function AppShell() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StorageProvider>
          <ProjectListProvider>
            <AppContent />
          </ProjectListProvider>
        </StorageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
