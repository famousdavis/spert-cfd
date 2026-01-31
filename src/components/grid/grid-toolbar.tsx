'use client';

import { Plus, Download, Upload, ArrowUpDown } from 'lucide-react';

interface GridToolbarProps {
  snapshotCount: number;
  newestFirst: boolean;
  onAddRow: () => void;
  onExportCSV: () => void;
  onImportCSV: () => void;
  onToggleSort: () => void;
}

export function GridToolbar({
  snapshotCount,
  newestFirst,
  onAddRow,
  onExportCSV,
  onImportCSV,
  onToggleSort,
}: GridToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Data ({snapshotCount} snapshots)
      </h2>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSort}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title={newestFirst ? 'Showing newest first' : 'Showing oldest first'}
        >
          <ArrowUpDown size={12} />
          {newestFirst ? 'Newest' : 'Oldest'}
        </button>

        <button
          onClick={onImportCSV}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Import CSV"
        >
          <Upload size={12} />
          CSV
        </button>

        <button
          onClick={onExportCSV}
          disabled={snapshotCount === 0}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          title="Export CSV"
        >
          <Download size={12} />
          CSV
        </button>

        <button
          onClick={onAddRow}
          className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
        >
          <Plus size={12} />
          Add Row
        </button>
      </div>
    </div>
  );
}
