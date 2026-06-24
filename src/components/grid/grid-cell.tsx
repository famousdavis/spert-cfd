// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useEffect } from 'react';

interface GridCellProps {
  /** Stable unique identifier — used for both `id` and `name` so each
   *  cell input satisfies the form-field-needs-id-or-name browser hint
   *  and is autofill-distinguishable from its siblings. Caller should
   *  supply something like `${snap.date}-${state.id}`. */
  fieldId: string;
  value: number;
  onChange: (value: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  isWipViolation: boolean;
  wipLimit?: number;
  ariaLabel: string;
}

/**
 * Numeric grid cell with a local draft buffer (A3 fix).
 *
 * While focused, displays a local draft and ignores incoming `value` prop
 * changes (focus guard), preventing server-ack snapshots from clobbering
 * keystrokes in cloud mode. Commits to the store via `onChange` on blur,
 * Enter, or unmount (React does not fire blur on unmount).
 */
export function GridCell({
  fieldId,
  value,
  onChange,
  onKeyDown,
  inputRef,
  isWipViolation,
  wipLimit,
  ariaLabel,
}: GridCellProps) {
  const [draft, setDraft] = useState(value);
  const isFocusedRef = useRef(false);
  // Refs for unmount-commit: avoids stale closures in the cleanup return.
  const draftRef = useRef(draft);
  const onChangeRef = useRef(onChange);

  // Sync refs after every render so the unmount cleanup sees latest values.
  useEffect(() => {
    draftRef.current = draft;
    onChangeRef.current = onChange;
  });

  // Focus guard: update draft from prop only when NOT focused.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  // Unmount-commit: commit draft if the cell unmounts while focused.
  // React does NOT fire blur on unmount (e.g., tab navigation away from DataGrid).
  useEffect(() => {
    return () => {
      if (isFocusedRef.current) {
        onChangeRef.current(draftRef.current);
      }
    };
  }, []);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    e.target.select();
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    onChange(draft);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setDraft(isNaN(val) || val < 0 ? 0 : val);
    // Store write happens only on blur/Enter/unmount — not on every keystroke.
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      isFocusedRef.current = false;
      onChange(draft);
      e.currentTarget.blur();
    }
    onKeyDown(e);
  };

  return (
    <td className="p-0">
      <input
        id={fieldId}
        name={fieldId}
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        value={draft}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full h-8 px-2 py-1.5 text-[13px] font-mono text-right border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
          isWipViolation
            ? 'bg-amber-50 ring-1 ring-inset ring-amber-400'
            : 'bg-transparent'
        }`}
        title={
          isWipViolation
            ? `WIP limit is ${wipLimit}, current count is ${value}`
            : undefined
        }
        aria-label={ariaLabel}
      />
    </td>
  );
}
