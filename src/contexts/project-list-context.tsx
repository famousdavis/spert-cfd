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
import type { StorageIndex } from '@/types';
import {
  loadIndex,
  saveIndex,
  loadProject,
  saveProject,
  deleteProject as deleteProjectFromStorage,
  importProject,
} from '@/lib/storage';
import { DATA_VERSION } from '@/lib/migrations';
import { createSampleProject } from '@/lib/sample-data';

interface ProjectListItem {
  id: string;
  name: string;
}

interface ProjectListContextValue {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  isLoaded: boolean;
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  switchProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  importProjectFromJson: (json: string) => string | null;
}

const ProjectListContext = createContext<ProjectListContextValue | null>(null);

export function useProjectList() {
  const ctx = useContext(ProjectListContext);
  if (!ctx) {
    throw new Error('useProjectList must be used within ProjectListProvider');
  }
  return ctx;
}

function loadProjectList(index: StorageIndex): ProjectListItem[] {
  return index.projectIds
    .map((id) => {
      const project = loadProject(id);
      return project ? { id: project.id, name: project.name } : null;
    })
    .filter((p): p is ProjectListItem => p !== null);
}

const EMPTY_INDEX: StorageIndex = {
  version: DATA_VERSION,
  activeProjectId: null,
  projectIds: [],
};

export function ProjectListProvider({ children }: { children: ReactNode }) {
  // Start with empty state on both server and client to avoid hydration mismatch
  const [index, setIndex] = useState<StorageIndex>(EMPTY_INDEX);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount (client only)
  useEffect(() => {
    let stored = loadIndex();

    if (stored.projectIds.length === 0) {
      const sample = createSampleProject();
      saveProject(sample);
      stored = {
        version: DATA_VERSION,
        activeProjectId: sample.id,
        projectIds: [sample.id],
      };
      saveIndex(stored);
    }

    // Deferred localStorage load for SSR hydration safety — this is an external system sync
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deferred localStorage load for SSR safety
    setIndex(stored);
    setProjects(loadProjectList(stored));
    setIsLoaded(true);
  }, []);

  // Sync projects list when index changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects(loadProjectList(index));
    }
  }, [index, isLoaded]);

  const createProject = useCallback(
    (name: string): string => {
      const id = nanoid(8);
      const now = new Date().toISOString();
      const project = {
        id,
        name,
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
      saveProject(project);

      // Use functional update to avoid stale closure
      setIndex((prev) => {
        const newIndex: StorageIndex = {
          ...prev,
          activeProjectId: id,
          projectIds: [...prev.projectIds, id],
        };
        saveIndex(newIndex);
        return newIndex;
      });

      setProjects((prev) => [...prev, { id, name }]);
      return id;
    },
    []
  );

  const deleteProject = useCallback(
    (id: string) => {
      deleteProjectFromStorage(id);
      const newIndex = loadIndex();
      setIndex(newIndex);
    },
    []
  );

  const switchProject = useCallback(
    (id: string) => {
      // Use functional update to avoid stale closure
      setIndex((prev) => {
        const newIndex: StorageIndex = { ...prev, activeProjectId: id };
        saveIndex(newIndex);
        return newIndex;
      });
    },
    []
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      const project = loadProject(id);
      if (!project) return;
      project.name = name;
      saveProject(project);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name } : p))
      );
    },
    []
  );

  const importProjectFromJson = useCallback(
    (json: string): string | null => {
      const imported = importProject(json);
      if (!imported) return null;

      saveProject(imported);

      // Use functional update to avoid stale closure
      setIndex((prev) => {
        const newIndex: StorageIndex = {
          ...prev,
          activeProjectId: imported.id,
          projectIds: [...prev.projectIds, imported.id],
        };
        saveIndex(newIndex);
        return newIndex;
      });

      setProjects((prev) => [...prev, { id: imported.id, name: imported.name }]);
      return imported.id;
    },
    []
  );

  return (
    <ProjectListContext.Provider
      value={{
        projects,
        activeProjectId: index.activeProjectId,
        isLoaded,
        createProject,
        deleteProject,
        switchProject,
        renameProject,
        importProjectFromJson,
      }}
    >
      {children}
    </ProjectListContext.Provider>
  );
}
