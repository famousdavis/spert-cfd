// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context';
import { ActiveProjectProvider } from '@/contexts/active-project-context';
import { AuthProvider } from '@/contexts/auth-context';
import { ErrorBoundary } from './error-boundary';
import { ProjectSelector } from './project-selector';
import { ProjectDashboard } from './project-dashboard';
import { FirstRunBanner } from './first-run-banner';
import { LocalStorageWarningBanner } from './local-storage-warning-banner';
import { Footer } from './footer';

function AppContent() {
  const { isLoaded } = useProjectList();

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
        <ProjectSelector />
        <ProjectDashboard />
        <Footer />
      </div>
    </ActiveProjectProvider>
  );
}

export function AppShell() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProjectListProvider>
          <AppContent />
        </ProjectListProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
