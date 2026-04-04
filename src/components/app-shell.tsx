// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useCallback } from 'react';
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
import { SettingsTab } from './settings-tab';
import { AboutTab } from './about-tab';
import { Footer } from './footer';

function AppContent() {
  const { isLoaded, switchProject } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabId>('projects');

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
        <FirstRunBanner />
        <LocalStorageWarningBanner />
        <AppHeader />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'projects' && (
            <ProjectsTab onOpenInCfd={handleOpenInCfd} />
          )}
          {activeTab === 'cfd' && (
            <ProjectDashboard onGoToProjects={() => setActiveTab('projects')} />
          )}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'about' && <AboutTab />}
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
