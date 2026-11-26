// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Suspense, useState, useCallback, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context';
import { ActiveProjectProvider, useActiveProject } from '@/contexts/active-project-context';
import { AuthProvider } from '@/contexts/auth-context';
import { StorageProvider } from '@/contexts/storage-context';
import { cfdHeading } from '@/lib/cfd-heading';
import { ErrorBoundary } from './error-boundary';
import { AppHeader } from './app-header';
import { TabNavigation, type TabId } from './tab-navigation';
import { HeadingRow } from './heading-row';
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

/**
 * The SPERT® Suite app frame (FRAME26, contract FRAME-CONTRACT.md, v0.22.0),
 * held by the root layout around every route: the skip link, the brand row,
 * the navigation row, the notices slot, `main` and the footer, in one 1600 px
 * column. The styles are the vendored `src/styles/spert-frame.css`; the
 * `data-sf` hooks let `frame-check` find each landmark without guessing.
 *
 * ⚠️ HELD BY THE LAYOUT (src/app/layout.tsx), not by a page, so it never
 * remounts between "/" and "/changelog": the active tab, the notices'
 * dismissals and the providers survive the visit. On "/" `main` shows the
 * active tab; on any other route it shows that route's page (`children`) and
 * no navigation item is active. A tab chosen there (an item, the brand) sets
 * the tab in state, then returns to "/": the tab travels in state, never in
 * the URL. Since v0.22.0 every route mounts auth and storage, the changelog
 * and the 404 included.
 *
 * Until v0.22.0 this was a window-tall box (`h-screen`) whose tabs each
 * scrolled inside it. Now Projects, Settings, About and the changelog scroll
 * the document, and the footer flows after them. Only the CFD tab keeps a
 * fitted view (exception X1, DASH26 R18): its body fills the window between
 * the frame and the footer, and scrolls inside.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {/* Contract §7, "Loading": while the storage driver is not ready (every
            first load, and every storage switch), the gate shows the frame with
            only its body loading, never a bare "Loading..." screen. */}
        <StorageProvider fallback={<LoadingFrame>{children}</LoadingFrame>}>
          <ProjectListProvider>
            <AppContent>{children}</AppContent>
          </ProjectListProvider>
        </StorageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

/** "/" is the tabs' route; `null` only outside the App Router (unit tests). */
function useTabsRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const onTabsRoute = pathname === '/' || pathname === null;
  const leaveForTabs = useCallback(() => {
    if (!onTabsRoute) router.push('/');
  }, [onTabsRoute, router]);
  return { pathname, onTabsRoute, leaveForTabs };
}

/** `main`'s classes: X4 caps Settings, About and the changelog (not their heading row); X1 fits the CFD tab. */
function mainClass(onTabsRoute: boolean, pathname: string | null, tab: TabId): string {
  if (onTabsRoute && tab === 'cfd') return 'sf-col sf-main sf-main--fit flex flex-col';
  const capped = onTabsRoute ? tab === 'settings' || tab === 'about' : pathname === '/changelog';
  return capped ? 'sf-col sf-main sf-main--capped' : 'sf-col sf-main';
}

/** The `h1` of a tab whose body is still loading, or of a tab with no project data. */
function TabHeading({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'projects':
      return <HeadingRow>Projects</HeadingRow>;
    case 'cfd':
      return <HeadingRow>{cfdHeading(null).text}</HeadingRow>;
    case 'settings':
      return <HeadingRow>Settings</HeadingRow>;
    case 'about':
      // The ® is never bold: the heading is 700, the mark 400.
      return <HeadingRow>About SPERT<span className="font-normal">®</span> CFD</HeadingRow>;
  }
}

/** The body while loading (contract §7): the tab's heading row, then the words. On another route, its page. */
function loadingBody(onTabsRoute: boolean, tab: TabId, page: ReactNode): ReactNode {
  if (!onTabsRoute) return page;
  return (
    <>
      <TabHeading tab={tab} />
      <p className="sf-below text-gray-500 dark:text-gray-400">Loading...</p>
    </>
  );
}

interface FrameProps {
  activeTab: TabId | null;
  onSelectTab: (tab: TabId) => void;
  onOpenModal: () => void;
  accountUnavailable?: boolean;
  notices?: ReactNode;
  mainClassName: string;
  body: ReactNode;
  after?: ReactNode;
}

/** The frame itself, the same in every state: loading, loaded, on any route. */
function Frame({ activeTab, onSelectTab, onOpenModal, accountUnavailable, notices, mainClassName, body, after }: FrameProps) {
  return (
    <div className="sf-app" data-sf="app">
      <a href="#main" className="sf-skip" data-sf="skip">
        Skip to main content
      </a>
      <AppHeader
        onNavigateHome={() => onSelectTab('projects')}
        onOpenModal={onOpenModal}
        accountUnavailable={accountUnavailable}
      />
      <TabNavigation activeTab={activeTab} onTabChange={onSelectTab} />
      {/* The app-wide notices, in the frame's slot directly under the
          navigation: the invitation, then the terms notice, then the
          local-storage caution, then the cloud-load caution (contract §6,
          today's order). The stylesheet hides the slot when no notice shows. */}
      <div className="sf-col sf-notices" data-sf="notices">
        {notices}
      </div>
      <main id="main" className={mainClassName} data-sf="main">
        {body}
      </main>
      <Footer />
      {after}
    </div>
  );
}

/** The storage gate's frame: the driver is not ready, so the list is not mounted and Cloud Storage can't open yet. */
function LoadingFrame({ children }: { children?: ReactNode }) {
  const { pathname, onTabsRoute, leaveForTabs } = useTabsRoute();
  return (
    <Frame
      activeTab={onTabsRoute ? 'projects' : null}
      onSelectTab={leaveForTabs}
      onOpenModal={() => {}}
      accountUnavailable
      mainClassName={mainClass(onTabsRoute, pathname, 'projects')}
      body={loadingBody(onTabsRoute, 'projects', children)}
    />
  );
}

/** The CFD tab's `h1`: the project the panel shows (the LOADED one, as its per-project key), else "CFD". */
function CfdHeadingRow() {
  const { project } = useActiveProject();
  const heading = cfdHeading(project);
  return <HeadingRow title={heading.title}>{heading.text}</HeadingRow>;
}

function AppContent({ children }: { children?: ReactNode }) {
  const { isLoaded, switchProject } = useProjectList();
  const { pathname, onTabsRoute, leaveForTabs } = useTabsRoute();
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

  // Every other way of choosing a tab: the navigation items and the brand.
  // It drops a request the picker never took (it does not mount when the CFD
  // tab fails as a whole), so it cannot pull focus to the picker on a later,
  // unrelated visit (DASH26 PR #108 review, -07). Off "/" it returns to the
  // tabs' route, carrying the tab in state.
  const selectTab = useCallback(
    (tab: TabId) => {
      pickerFocusPending.current = false;
      setActiveTab(tab);
      leaveForTabs();
    },
    [leaveForTabs]
  );

  const className = mainClass(onTabsRoute, pathname, activeTab);

  if (!isLoaded) {
    return (
      <Frame
        activeTab={onTabsRoute ? activeTab : null}
        onSelectTab={selectTab}
        onOpenModal={() => {}}
        accountUnavailable
        mainClassName={className}
        body={loadingBody(onTabsRoute, activeTab, children)}
      />
    );
  }

  // Each tab's body under the frame. The heading rows of the CFD tab, Settings
  // and About are rendered here, OUTSIDE the tab's error boundary, so a view
  // that fails keeps its `h1`; Projects renders its own, because its
  // toolbar's state lives in ProjectsTab. Every heading row is a direct child
  // of `main` (X4 caps the other children). v0.16.4: an error in one tab
  // leaves the frame and sign-out up. Keyed by the tab only: v0.17.0 stopped
  // keying the Projects tab by the open project, and v0.18.0 moved the CFD
  // tab's per-project key inside the tab, below its project picker
  // (project-dashboard.tsx).
  const tabBody = (): ReactNode => {
    const boundary = (view: ReactNode) => (
      <ErrorBoundary key={activeTab} fallback={<ViewErrorNotice />}>
        {view}
      </ErrorBoundary>
    );
    switch (activeTab) {
      case 'projects':
        return boundary(<ProjectsTab onOpenInCfd={handleOpenInCfd} />);
      case 'cfd':
        // X1: the body fills the rest of the fitted `main`.
        return (
          <>
            <CfdHeadingRow />
            <div className="sf-below flex min-h-0 flex-1 flex-col">
              {boundary(
                <ProjectDashboard onGoToProjects={() => selectTab('projects')} takePickerFocus={takePickerFocus} />
              )}
            </div>
          </>
        );
      case 'settings':
      case 'about':
        return (
          <>
            <TabHeading tab={activeTab} />
            <div className="sf-below">{boundary(activeTab === 'settings' ? <SettingsTab /> : <AboutTab />)}</div>
          </>
        );
    }
  };

  return (
    <ActiveProjectProvider>
      <Frame
        activeTab={onTabsRoute ? activeTab : null}
        onSelectTab={selectTab}
        onOpenModal={() => setCloudModalOpen(true)}
        notices={
          <>
            {/* InvitationBanner uses next/navigation hooks (useSearchParams),
                which need a Suspense boundary in the App Router or `next build`
                fails. First, since it is claim-critical when present. */}
            <Suspense fallback={null}>
              <InvitationBanner />
            </Suspense>
            <FirstRunBanner />
            <LocalStorageWarningBanner />
            <CloudLoadNoticeBanner />
          </>
        }
        mainClassName={className}
        body={onTabsRoute ? tabBody() : children}
        after={<CloudStorageModal open={cloudModalOpen} onClose={() => setCloudModalOpen(false)} />}
      />
    </ActiveProjectProvider>
  );
}
