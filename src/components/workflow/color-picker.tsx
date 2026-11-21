// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, useState, useRef } from 'react';
import { PRESET_COLORS, getContrastColor } from '@/lib/colors';
import { useEscapeKey, useClickOutside } from '@/lib/use-dismiss';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const hexInputId = useId();
  const [hexInput, setHexInput] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, onClose);
  useEscapeKey(onClose);

  const handleHexChange = (val: string) => {
    // Ensure it starts with #
    const hex = val.startsWith('#') ? val : '#' + val;
    setHexInput(hex);
    const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
    setIsValid(valid);
  };

  const handleHexCommit = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      onChange(hexInput.toLowerCase());
      onClose();
    }
  };

  // The popover needs a definite width. Absolutely positioned, it would
  // otherwise shrink to fit its 20px trigger, and `grid-cols-4` tracks are
  // `minmax(0, 1fr)`, so the grid's only minimum is its gaps: the columns
  // collapse to 0px and the 24px swatches overlap at a 6px pitch.
  // w-33 = 132px = 4 swatches × 24px + 3 gaps × 6px + 2 × 8px padding
  // + 2 × 1px border (border-box).
  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-10 mt-1 w-33 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 shadow-lg"
    >
      {/* Preset swatches: 4x3 grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => {
              onChange(color);
              onClose();
            }}
            className="relative h-6 w-6 rounded-md border border-gray-200 dark:border-gray-500 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
            style={{ backgroundColor: color }}
            title={color}
            aria-label={`Color ${color}`}
          >
            {value === color && (
              <Check
                size={14}
                className="absolute inset-0 m-auto"
                style={{ color: getContrastColor(color) }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Custom hex input */}
      <input
        id={hexInputId}
        name={hexInputId}
        type="text"
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleHexCommit();
        }}
        maxLength={7}
        placeholder="#000000"
        autoComplete="off"
        className={`w-full rounded border px-1.5 py-0.5 text-xs font-mono dark:bg-gray-700 dark:text-gray-100 ${
          isValid ? 'border-gray-300 dark:border-gray-600' : 'border-red-400 dark:border-red-400'
        }`}
        aria-label="Custom hex color"
      />
    </div>
  );
}
