'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Snapshot } from '@/types';
import { useActiveProject } from '@/contexts/active-project-context';
import { snapshotsToCSV } from '@/lib/csv';
import { sortWorkflow, sortSnapshots, mergeSnapshots } from '@/lib/dates';
import { GridToolbar } from './grid-toolbar';
import { GridTable } from './grid-table';
import { AddRowDialog } from './add-row-dialog';
import { CsvImportModal } from './csv-import-modal';

export function DataGrid() {
  const { project, workflow, snapshots, settings, updateSnapshots, updateSettings } =
    useActiveProject();

  const [showAddRow, setShowAddRow] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  const sorted = useMemo(() => sortWorkflow(workflow), [workflow]);
  const newestFirst = settings.gridSortNewestFirst;
  const sortedSnapshots = sortSnapshots(snapshots, newestFirst);

  const handleCellChange = useCallback(
    (date: string, stateId: string, value: number) => {
      const updated = snapshots.map((s) => {
        if (s.date !== date) return s;
        return {
          ...s,
          counts: { ...s.counts, [stateId]: value },
        };
      });
      updateSnapshots(updated);
    },
    [snapshots, updateSnapshots],
  );

  const handleAddRow = useCallback(
    (newSnap: Snapshot) => {
      updateSnapshots(mergeSnapshots(snapshots, [newSnap]));
    },
    [snapshots, updateSnapshots],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deletingDate) return;
    updateSnapshots(snapshots.filter((s) => s.date !== deletingDate));
    setDeletingDate(null);
  }, [deletingDate, snapshots, updateSnapshots]);

  const handleExportCSV = useCallback(() => {
    if (!project) return;
    const csv = snapshotsToCSV(snapshots, workflow, newestFirst);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Sanitize filename: replace non-alphanumeric chars (except - and _) with underscores
    const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');
    a.download = `${safeName}-snapshots.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, snapshots, workflow, newestFirst]);

  const handleImportCSV = useCallback(
    (importedSnapshots: Snapshot[]) => {
      updateSnapshots(importedSnapshots);
    },
    [updateSnapshots],
  );

  const handleToggleSort = useCallback(() => {
    updateSettings({ gridSortNewestFirst: !newestFirst });
  }, [newestFirst, updateSettings]);

  return (
    <section className="mt-6">
      <GridToolbar
        snapshotCount={snapshots.length}
        newestFirst={newestFirst}
        onAddRow={() => setShowAddRow(true)}
        onExportCSV={handleExportCSV}
        onImportCSV={() => setShowCsvImport(true)}
        onToggleSort={handleToggleSort}
      />

      {showAddRow && (
        <AddRowDialog
          snapshots={snapshots}
          workflowStateIds={sorted.map((s) => s.id)}
          onAdd={handleAddRow}
          onClose={() => setShowAddRow(false)}
        />
      )}

      {snapshots.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
          No snapshots yet. Click &quot;Add Row&quot; to begin tracking.
        </div>
      ) : (
        <GridTable
          snapshots={sortedSnapshots}
          workflow={workflow}
          showWipWarnings={settings.showWipWarnings}
          onCellChange={handleCellChange}
          onDeleteRow={(date) => setDeletingDate(date)}
          deletingDate={deletingDate}
          onConfirmDelete={handleConfirmDelete}
          onCancelDelete={() => setDeletingDate(null)}
        />
      )}

      {showCsvImport && (
        <CsvImportModal
          workflow={workflow}
          snapshots={snapshots}
          onImport={handleImportCSV}
          onClose={() => setShowCsvImport(false)}
        />
      )}
    </section>
  );
}
