// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

interface GridCellProps {
  value: number;
  onChange: (value: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  isWipViolation: boolean;
  wipLimit?: number;
  ariaLabel: string;
}

export function GridCell({
  value,
  onChange,
  onKeyDown,
  inputRef,
  isWipViolation,
  wipLimit,
  ariaLabel,
}: GridCellProps) {
  return (
    <td className="p-0">
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          onChange(isNaN(val) || val < 0 ? 0 : val);
        }}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
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
