// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { nanoid } from 'nanoid';
import { useStorage } from './storage-context';
import type { ProjectListItem } from '@/lib/storage-driver';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { createSampleProject } from '@/lib/sample-data';

interface ProjectListContextValue {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  isLoaded: boolean;
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  switchProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  importProjectFromJson: (json: string) => string | null;
  reorderProjects: (orderedIds: string[]) => void;
}

const ProjectListContext = createContext<ProjectListContextValue | null>(null);

export function useProjectList() {
  const ctx = useContext(ProjectListContext);
  if (!ctx) {
    throw new Error('useProjectList must be used within ProjectListProvider');
  }
  return ctx;
}

export function ProjectListProvider({ children }: { children: ReactNode }) {
  const { driver } = useStorage();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load project list from driver on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await driver.loadProjectList();
      if (cancelled) return;

      // Sample project seeding: local mode only (§8.4)
      // In cloud mode, an empty list shows the empty state.
      if (list.length === 0 && driver.mode === 'local') {
        const sample = createSampleProject();
        await driver.createProject(sample);
        driver.setActiveProjectId(sample.id);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- deferred async load
        setProjects([{ id: sample.id, name: sample.name }]);
        setActiveProjectId(sample.id);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- deferred async load
        setProjects(list);
        setActiveProjectId(driver.getActiveProjectId());
      }
      setIsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [driver]);

  // Subscribe to remote changes in cloud mode
  useEffect(() => {
    if (driver.mode !== 'cloud') return;
    const unsub = driver.onProjectListChange((list) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- real-time sync callback
      setProjects(list);
    });
    return unsub;
  }, [driver]);

  const createProject = useCallback(
    (name: string): string => {
      const safeName = name.slice(0, MAX_NAME_LENGTH);
      const id = nanoid(8);
      const now = new Date().toISOString();
      const project = {
        id,
        name: safeName,
        createdAt: now,
        updatedAt: now,
        workflow: [
          { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog' as const, order: 0 },
          { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active' as const, order: 1 },
          { id: 'done', name: 'Done', color: '#22c55e', category: 'done' as const, order: 2 },
        ],
        snapshots: [],
        settings: {
          gridSortNewestFirst: true,
          showWipWarnings: true,
          metricsPeriod: { kind: 'all' as const },
        },
      };

      // Fire and forget — driver handles persistence
      driver.createProject(project);
      driver.setActiveProjectId(id);

      setProjects((prev) => [...prev, { id, name: safeName }]);
      setActiveProjectId(id);
      return id;
    },
    [driver]
  );

  const deleteProject = useCallback(
    (id: string) => {
      driver.deleteProject(id).then(async () => {
        const list = await driver.loadProjectList();
        setProjects(list);

        // Reset active project if the deleted one was active
        if (id === activeProjectId) {
          const newActive = list[0]?.id ?? null;
          driver.setActiveProjectId(newActive);
          setActiveProjectId(newActive);
        }
      });
    },
    [driver, activeProjectId]
  );

  const switchProject = useCallback(
    (id: string) => {
      driver.setActiveProjectId(id);
      setActiveProjectId(id);
    },
    [driver]
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      if (!name.trim() || name.length > MAX_NAME_LENGTH) return;

      driver.loadProject(id).then((project) => {
        if (!project) return;
        const updated = { ...project, name };
        driver.saveProject(updated);
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name } : p))
        );
      });
    },
    [driver]
  );

  const importProjectFromJson = useCallback(
    (json: string): string | null => {
      const imported = driver.importProject(json);
      if (!imported) return null;

      // Use createProject (not saveProject) so index is updated in local mode
      // and ownership fields are set in cloud mode (§8.9)
      driver.createProject(imported);
      driver.setActiveProjectId(imported.id);

      setProjects((prev) => [...prev, { id: imported.id, name: imported.name }]);
      setActiveProjectId(imported.id);
      return imported.id;
    },
    [driver]
  );

  const reorderProjects = useCallback(
    (orderedIds: string[]) => {
      // Optimistic update — reorder local state immediately
      setProjects((prev) => {
        // Validate: must be a permutation of existing project IDs
        const currentIds = prev.map((p) => p.id);
        if (
          orderedIds.length !== currentIds.length ||
          new Set(orderedIds).size !== orderedIds.length ||
          !orderedIds.every((id) => currentIds.includes(id))
        ) {
          return prev; // Reject silently
        }

        const byId = new Map(prev.map((p) => [p.id, p]));
        return orderedIds.map((id) => byId.get(id)!);
      });

      // Persist via driver
      driver.reorderProjects(orderedIds);
    },
    [driver]
  );

  return (
    <ProjectListContext.Provider
      value={{
        projects,
        activeProjectId,
        isLoaded,
        createProject,
        deleteProject,
        switchProject,
        renameProject,
        importProjectFromJson,
        reorderProjects,
      }}
    >
      {children}
    </ProjectListContext.Provider>
  );
}
