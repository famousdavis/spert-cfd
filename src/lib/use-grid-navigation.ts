import { useRef, useCallback } from 'react';

export function useGridNavigation(rows: number, cols: number) {
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const registerCell = useCallback(
    (row: number, col: number) => (el: HTMLInputElement | null) => {
      const key = `${row}-${col}`;
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  const focusCell = useCallback((row: number, col: number) => {
    const el = cellRefs.current.get(`${row}-${col}`);
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleKeyDown = useCallback(
    (row: number, col: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      const input = e.currentTarget;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) focusCell(row - 1, col);
          break;
        case 'ArrowDown':
        case 'Enter':
          e.preventDefault();
          if (row < rows - 1) focusCell(row + 1, col);
          break;
        case 'ArrowLeft':
          if (input.selectionStart === 0) {
            e.preventDefault();
            if (col > 0) focusCell(row, col - 1);
          }
          break;
        case 'ArrowRight':
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            if (col < cols - 1) focusCell(row, col + 1);
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            if (col > 0) focusCell(row, col - 1);
            else if (row > 0) focusCell(row - 1, cols - 1);
          } else {
            if (col < cols - 1) focusCell(row, col + 1);
            else if (row < rows - 1) focusCell(row + 1, 0);
          }
          break;
        case 'Escape':
          input.blur();
          break;
      }
    },
    [rows, cols, focusCell],
  );

  return { registerCell, handleKeyDown };
}
