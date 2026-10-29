// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Suspense, useState, useCallback } from 'react';
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

function ViewErrorNotice() {
  return (
    <div role="alert" className="mx-auto mt-8 max-w-xl rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">This view could not be displayed.</p>
      <p className="mt-1">Some of its data could not be shown. Other tabs and projects still work.</p>
    </div>
  );
}

function AppContent() {
  const { isLoaded, switchProject, activeProjectId } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabId>('projects');
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  const handleOpenInCfd = useCallback(
    (id: string) => {
      switchProject(id);
      setActiveTab('cfd');
    },
    [switchProject]
  );

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <ActiveProjectProvider>
      <div className="flex h-screen flex-col">
        <AppHeader onOpenModal={() => setCloudModalOpen(true)} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
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
              sign-out up, so the user can move on. */}
          <ErrorBoundary key={`${activeTab}:${activeProjectId}`} fallback={<ViewErrorNotice />}>
            {activeTab === 'projects' && (
              <ProjectsTab onOpenInCfd={handleOpenInCfd} />
            )}
            {activeTab === 'cfd' && (
              <ProjectDashboard onGoToProjects={() => setActiveTab('projects')} />
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
