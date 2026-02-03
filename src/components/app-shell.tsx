'use client';

import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context';
import { ActiveProjectProvider } from '@/contexts/active-project-context';
import { ErrorBoundary } from './error-boundary';
import { ProjectSelector } from './project-selector';
import { ProjectDashboard } from './project-dashboard';
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
      <ProjectListProvider>
        <AppContent />
      </ProjectListProvider>
    </ErrorBoundary>
  );
}
