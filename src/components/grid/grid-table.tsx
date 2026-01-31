'use client';

import type { Snapshot, WorkflowState } from '@/types';
import { formatDate, sortWorkflow } from '@/lib/dates';
import { useGridNavigation } from '@/lib/use-grid-navigation';
import { GridCell } from './grid-cell';
import { Trash2 } from 'lucide-react';

interface GridTableProps {
  snapshots: Snapshot[];
  workflow: WorkflowState[];
  showWipWarnings: boolean;
  onCellChange: (date: string, stateId: string, value: number) => void;
  onDeleteRow: (date: string) => void;
  deletingDate: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function GridTable({
  snapshots,
  workflow,
  showWipWarnings,
  onCellChange,
  onDeleteRow,
  deletingDate,
  onConfirmDelete,
  onCancelDelete,
}: GridTableProps) {
  const sortedWorkflow = sortWorkflow(workflow);
  const { registerCell, handleKeyDown } = useGridNavigation(
    snapshots.length,
    sortedWorkflow.length,
  );

  const isWipViolation = (state: WorkflowState, count: number): boolean => {
    if (!showWipWarnings) return false;
    if (state.wipLimit === undefined) return false;
    return count > state.wipLimit;
  };

  return (
    <div className="overflow-x-auto rounded border border-gray-200" role="grid">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50 z-10">
              Date
            </th>
            {sortedWorkflow.map((state) => (
              <th
                key={state.id}
                className="px-2 py-2 font-medium text-gray-600 whitespace-nowrap text-right"
              >
                <span className="flex items-center justify-end gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: state.color }}
                  />
                  {state.name}
                  {state.wipLimit !== undefined && (
                    <span className="text-xs text-gray-400 font-normal">
                      ({state.wipLimit})
                    </span>
                  )}
                </span>
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snap, rowIdx) => {
            if (deletingDate === snap.date) {
              return (
                <tr key={snap.date} className="border-t border-gray-100">
                  <td
                    colSpan={sortedWorkflow.length + 2}
                    className="px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-700">
                        Delete snapshot for {formatDate(snap.date)}?
                      </span>
                      <button
                        onClick={onConfirmDelete}
                        className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={onCancelDelete}
                        className="rounded px-2 py-0.5 text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={snap.date} className="border-t border-gray-100" role="row">
                <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">
                  {formatDate(snap.date)}
                </td>
                {sortedWorkflow.map((state, colIdx) => {
                  const count = snap.counts[state.id] ?? 0;
                  return (
                    <GridCell
                      key={state.id}
                      value={count}
                      onChange={(val) => onCellChange(snap.date, state.id, val)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, colIdx, e)}
                      inputRef={registerCell(rowIdx, colIdx)}
                      isWipViolation={isWipViolation(state, count)}
                      wipLimit={state.wipLimit}
                      ariaLabel={`${state.name} count for ${snap.date}`}
                    />
                  );
                })}
                <td className="px-1">
                  <button
                    onClick={() => onDeleteRow(snap.date)}
                    className="rounded p-1 text-gray-300 hover:text-red-600"
                    title="Delete row"
                    aria-label={`Delete snapshot for ${snap.date}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
