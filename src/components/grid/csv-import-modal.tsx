// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { WorkflowState, Snapshot } from '@/types';
import {
  parseCSV,
  suggestMapping,
  applyCSVImport,
  CSV_DATE_FORMATS,
  type ParsedCSV,
  type ColumnTarget,
  type ImportResult,
} from '@/lib/csv';
import { sortWorkflow, formatDate } from '@/lib/dates';
import { useEscapeKey } from '@/lib/use-dismiss';
import { MAX_IMPORT_FILE_SIZE } from '@/lib/constants';
import { FileSpreadsheet, X } from 'lucide-react';

interface CsvImportModalProps {
  workflow: WorkflowState[];
  snapshots: Snapshot[];
  onImport: (snapshots: Snapshot[]) => void;
  onClose: () => void;
}

type Stage = 'upload' | 'mapping' | 'confirm';

/** Mirrors the file input's `accept`, which drag-and-drop bypasses */
const ACCEPTED_FILE = /\.(csv|tsv|txt)$/i;

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Drag-and-drop for the whole overlay. Drops are caught anywhere on it, so a
 * file that misses the drop zone never makes the browser leave the app to
 * open the file itself.
 */
function useFileDrop(enabled: boolean, onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);
  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = enabled ? 'copy' : 'none';
      setDragging(enabled);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (enabled && file) onFile(file);
    },
  };
  return { dragging, handlers };
}

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
  const modalRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose);

  // Focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const loadFile = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_FILE.test(file.name)) {
        setError(`"${file.name}" is not a CSV file. Choose a .csv file.`);
        return;
      }

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

  const { dragging, handlers: dropHandlers } = useFileDrop(stage === 'upload', loadFile);

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

  const importResult = useMemo(
    () => parsed && mappingValid
      ? applyCSVImport(parsed, mapping, snapshots, stateIds)
      : null,
    [parsed, mappingValid, mapping, snapshots, stateIds],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      {...dropHandlers}
    >
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
            <UploadStage dragging={dragging} error={error} onFile={loadFile} />
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
                      id={`csv-import-mapping-${i}`}
                      name={`csv-import-mapping-${i}`}
                      value={mapping[i]}
                      onChange={(e) =>
                        handleMappingChange(i, e.target.value as ColumnTarget)
                      }
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      aria-label={`Mapping for column ${header}`}
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
            <ImportSummary result={importResult} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t px-4 py-3">
          {stage !== 'upload' && (
            <button
              onClick={() => setStage(stage === 'confirm' ? 'mapping' : 'upload')}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Back
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto rounded px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
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

          {stage === 'confirm' && importResult && importResult.importedCount > 0 && (
            <button
              onClick={() => {
                onImport(importResult.snapshots);
                onClose();
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Import {count(importResult.importedCount, 'row')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface UploadStageProps {
  dragging: boolean;
  error: string | null;
  onFile: (file: File) => void;
}

function UploadStage({ dragging, error, onFile }: UploadStageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        className={`flex flex-col items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <FileSpreadsheet size={32} className="mb-3 text-gray-400" aria-hidden="true" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Choose CSV file
        </button>
        <p className="mt-2 text-xs text-gray-500">
          {dragging ? 'Drop the file to import it' : 'or drag and drop it here'}
        </p>
      </div>

      <input
        id="csv-import-file"
        name="csv-import-file"
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clear the value so choosing the same file again still fires onChange
          e.target.value = '';
          if (file) onFile(file);
        }}
        className="hidden"
        aria-label="CSV file to import"
      />

      <p className="mt-3 text-xs text-gray-500">
        The first row must be column headers: a Date column plus one column per
        workflow state. Dates as {CSV_DATE_FORMATS}.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  const { importedCount, overwrittenCount, skippedCount, skippedDates, dateRange } = result;
  const examples = skippedDates
    .slice(0, 3)
    .map((d) => (d ? `"${d}"` : '(blank)'))
    .join(', ');

  return (
    <div>
      {importedCount > 0 ? (
        <>
          <p className="text-sm text-gray-600 mb-3">Ready to import:</p>
          <ul className="text-sm text-gray-700 space-y-1 mb-3">
            <li>{count(importedCount, 'row')} to import</li>
            {dateRange && (
              <li>
                Dates: {formatDate(dateRange.first)} – {formatDate(dateRange.last)}
              </li>
            )}
            {overwrittenCount > 0 && (
              <li className="text-amber-700">
                {count(overwrittenCount, 'existing snapshot')} will be overwritten
              </li>
            )}
          </ul>
        </>
      ) : (
        <p role="alert" className="text-sm font-medium text-red-700 mb-3">
          Nothing can be imported — no row has a recognized date.
        </p>
      )}

      {skippedCount > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>
            {count(skippedCount, 'row')} skipped — date not recognized: {examples}
            {skippedDates.length > 3 && ', …'}
          </p>
          <p className="mt-1">Dates must be {CSV_DATE_FORMATS} (month first).</p>
        </div>
      )}
    </div>
  );
}
