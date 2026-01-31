'use client';

import { useState, useRef } from 'react';
import { useProjectList } from '@/contexts/project-list-context';
import { useActiveProject } from '@/contexts/active-project-context';
import { exportProject as exportProjectJson } from '@/lib/storage';

export function ProjectSelector() {
  const {
    projects,
    activeProjectId,
    createProject,
    deleteProject,
    switchProject,
    renameProject,
    importProjectFromJson,
  } = useProjectList();
  const { project } = useActiveProject();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createProject(name);
    setNewName('');
    setIsCreating(false);
  };

  const handleExport = () => {
    if (!project) return;
    const json = exportProjectJson(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      const id = importProjectFromJson(json);
      if (!id) {
        alert('Invalid project file. Please check the format and try again.');
      }
    };
    reader.onerror = () => {
      alert('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
    // Reset so the same file can be imported again
    e.target.value = '';
  };

  const handleStartRename = () => {
    if (!project) return;
    setRenameName(project.name);
    setIsRenaming(true);
  };

  const handleRename = () => {
    if (!activeProjectId || !renameName.trim()) return;
    renameProject(activeProjectId, renameName.trim());
    setIsRenaming(false);
  };

  const handleDelete = () => {
    if (!activeProjectId) return;
    if (projects.length <= 1) {
      alert('Cannot delete the last project.');
      return;
    }
    const name = projects.find((p) => p.id === activeProjectId)?.name;
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteProject(activeProjectId);
    }
  };

  return (
    <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
      <h1 className="text-lg font-bold whitespace-nowrap">CFD Lab</h1>

      {/* Project dropdown */}
      <select
        value={activeProjectId ?? ''}
        onChange={(e) => switchProject(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
        aria-label="Select project"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Rename */}
      {isRenaming ? (
        <span className="flex items-center gap-1">
          <input
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm w-40"
            autoFocus
          />
          <button
            onClick={handleRename}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={() => setIsRenaming(false)}
            className="rounded px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={handleStartRename}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          title="Rename project"
        >
          Rename
        </button>
      )}

      <div className="flex-1" />

      {/* Action buttons */}
      {isCreating ? (
        <span className="flex items-center gap-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(false);
            }}
            placeholder="Project name"
            className="rounded border border-gray-300 px-2 py-1 text-sm w-40"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
          >
            Create
          </button>
          <button
            onClick={() => setIsCreating(false)}
            className="rounded px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
        >
          New
        </button>
      )}

      <button
        onClick={handleImport}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
      >
        Import
      </button>

      <button
        onClick={handleExport}
        disabled={!project}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        Export
      </button>

      <button
        onClick={handleDelete}
        disabled={!activeProjectId || projects.length <= 1}
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
        title="Delete project"
      >
        Delete
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import project file"
      />
    </header>
  );
}
