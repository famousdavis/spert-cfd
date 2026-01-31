'use client';

import { useState, useMemo } from 'react';
import type { Snapshot } from '@/types';
import { todayISO, isValidDate, formatDate, sortSnapshots } from '@/lib/dates';

interface AddRowDialogProps {
  snapshots: Snapshot[];
  workflowStateIds: string[];
  onAdd: (snapshot: Snapshot) => void;
  onClose: () => void;
}

/** Find the most recent snapshot on or before `date`, or the first one overall */
function findPreviousSnapshot(sorted: Snapshot[], date: string): Snapshot | undefined {
  // Walk backwards to find the last snapshot <= date
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].date <= date) return sorted[i];
  }
  return undefined;
}

export function AddRowDialog({
  snapshots,
  workflowStateIds,
  onAdd,
  onClose,
}: AddRowDialogProps) {
  const [date, setDate] = useState(todayISO());
  const sorted = useMemo(() => sortSnapshots(snapshots), [snapshots]);

  const existingDates = new Set(snapshots.map((s) => s.date));
  const isDuplicate = existingDates.has(date);
  const valid = isValidDate(date);
  const previous = findPreviousSnapshot(sorted, date);

  const handleAdd = () => {
    if (!valid) return;
    const counts: Record<string, number> = {};
    for (const id of workflowStateIds) {
      counts[id] = previous ? (previous.counts[id] ?? 0) : 0;
    }
    onAdd({ date, counts });
    onClose();
  };

  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <label htmlFor="add-row-date" className="text-xs font-medium text-gray-700">
          Date:
        </label>
        <input
          id="add-row-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      {previous && (
        <p className="text-xs text-gray-500 mb-2">
          Copies values from {formatDate(previous.date)}
        </p>
      )}

      {!previous && snapshots.length === 0 && (
        <p className="text-xs text-gray-500 mb-2">
          First snapshot — all counts start at 0
        </p>
      )}

      {isDuplicate && (
        <p className="text-xs text-amber-700 mb-2">
          A snapshot for this date already exists and will be overwritten.
        </p>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={handleAdd}
          disabled={!valid}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={onClose}
          className="rounded px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
