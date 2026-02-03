'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { WorkflowState, Snapshot } from '@/types';
import {
  parseCSV,
  suggestMapping,
  applyCSVImport,
  type ParsedCSV,
  type ColumnTarget,
} from '@/lib/csv';
import { sortWorkflow } from '@/lib/dates';
import { useEscapeKey } from '@/lib/use-dismiss';
import { MAX_IMPORT_FILE_SIZE } from '@/lib/constants';
import { X } from 'lucide-react';

interface CsvImportModalProps {
  workflow: WorkflowState[];
  snapshots: Snapshot[];
  onImport: (snapshots: Snapshot[]) => void;
  onClose: () => void;
}

type Stage = 'upload' | 'mapping' | 'confirm';

export function CsvImportModal({
  workflow,
  snapshots,
  onImport,
  onClose,
}: CsvImportModalProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose);

  // Focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);

      // Check file size limit
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        setError('File too large. Maximum size is 1MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const result = parseCSV(text);

        if (result.headers.length === 0) {
          setError('No headers found in the file.');
          return;
        }
        if (result.rows.length === 0) {
          setError('File has headers but no data rows.');
          return;
        }

        setParsed(result);
        setMapping(suggestMapping(result.headers, workflow));
        setStage('mapping');
      };
      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
      };
      reader.readAsText(file);
    },
    [workflow],
  );

  const handleMappingChange = (colIndex: number, target: ColumnTarget) => {
    setMapping((prev) => {
      const next = [...prev];
      next[colIndex] = target;
      return next;
    });
  };

  const dateColumnCount = mapping.filter((m) => m === 'date').length;
  const mappedStateCount = mapping.filter(
    (m) => m !== 'date' && m !== 'skip',
  ).length;
  const mappingValid = dateColumnCount === 1 && mappedStateCount >= 1;

  const sortedWorkflow = useMemo(() => sortWorkflow(workflow), [workflow]);
  const stateIds = useMemo(() => sortedWorkflow.map((s) => s.id), [sortedWorkflow]);

  const importResult =
    parsed && mappingValid
      ? applyCSVImport(parsed, mapping, snapshots, stateIds)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-lg bg-white shadow-xl outline-none max-h-[80vh] flex flex-col"
        role="dialog"
        aria-label="Import CSV"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Import CSV</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 flex-1">
          {stage === 'upload' && (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Select a CSV file to import snapshot data.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileChange}
                className="text-sm"
              />
              {error && (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              )}
            </div>
          )}

          {stage === 'mapping' && parsed && (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Map each CSV column to a workflow state. Set one column as Date.
              </p>

              {/* Mapping dropdowns */}
              <div className="space-y-2 mb-4">
                {parsed.headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-28 truncate text-sm text-gray-700 font-medium">
                      {header}
                    </span>
                    <span className="text-gray-400 text-xs">→</span>
                    <select
                      value={mapping[i]}
                      onChange={(e) =>
                        handleMappingChange(i, e.target.value as ColumnTarget)
                      }
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="skip">Skip this column</option>
                      <option value="date">Date</option>
                      {sortedWorkflow.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Validation messages */}
              {dateColumnCount === 0 && (
                <p className="text-xs text-red-600 mb-2">
                  You must map exactly one column to Date.
                </p>
              )}
              {dateColumnCount > 1 && (
                <p className="text-xs text-red-600 mb-2">
                  Only one column can be mapped to Date.
                </p>
              )}
              {mappedStateCount === 0 && dateColumnCount === 1 && (
                <p className="text-xs text-amber-600 mb-2">
                  Map at least one column to a workflow state.
                </p>
              )}

              {/* Preview */}
              {parsed.rows.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">
                    Preview (first {Math.min(3, parsed.rows.length)} rows):
                  </p>
                  <div className="overflow-x-auto rounded border border-gray-200 text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          {parsed.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1 text-left font-medium text-gray-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 py-1 text-gray-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {stage === 'confirm' && importResult && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Ready to import:</p>
              <ul className="text-sm text-gray-700 space-y-1 mb-3">
                <li>{importResult.importedCount} rows to import</li>
                {importResult.overwrittenCount > 0 && (
                  <li className="text-amber-700">
                    {importResult.overwrittenCount} existing snapshots will be overwritten
                  </li>
                )}
                {importResult.skippedCount > 0 && (
                  <li className="text-gray-500">
                    {importResult.skippedCount} rows skipped (invalid date)
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>

          {stage === 'mapping' && (
            <button
              onClick={() => setStage('confirm')}
              disabled={!mappingValid}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          )}

          {stage === 'confirm' && importResult && (
            <button
              onClick={() => {
                onImport(importResult.snapshots);
                onClose();
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Import {importResult.importedCount} rows
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
