// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StateRow } from '../state-row';
import type { WorkflowState } from '@/types';

const baseState: WorkflowState = {
  id: 'in-dev',
  name: 'In Dev',
  color: '#3b82f6',
  category: 'active',
  order: 1,
  wipLimit: 3,
};

const defaultProps = {
  state: baseState,
  isFirst: false,
  isLast: false,
  canDelete: true,
  deleteWarning: false,
  onRename: vi.fn(),
  onSetColor: vi.fn(),
  onSetCategory: vi.fn(),
  onSetWipLimit: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onDelete: vi.fn(),
};

beforeEach(() => { vi.clearAllMocks(); });

describe('StateRow WIP limit — A3 draft buffer', () => {
  it('does NOT call onSetWipLimit while typing (only on blur)', () => {
    render(<StateRow {...defaultProps} />);
    const input = screen.getByLabelText(/WIP:/i) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.change(input, { target: { value: '10' } });
    expect(defaultProps.onSetWipLimit).not.toHaveBeenCalled();
  });
  it('calls onSetWipLimit with draft value on blur', () => {
    render(<StateRow {...defaultProps} />);
    const input = screen.getByLabelText(/WIP:/i) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(defaultProps.onSetWipLimit).toHaveBeenCalledOnce();
    expect(defaultProps.onSetWipLimit).toHaveBeenCalledWith(7);
  });
  it('calls onSetWipLimit on Enter', () => {
    render(<StateRow {...defaultProps} />);
    const input = screen.getByLabelText(/WIP:/i) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSetWipLimit).toHaveBeenCalledWith(2);
  });
  it('preserves draft while focused when prop changes (focus guard)', () => {
    const { rerender } = render(<StateRow {...defaultProps} />);
    const input = screen.getByLabelText(/WIP:/i) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9' } });
    rerender(<StateRow {...defaultProps} state={{ ...baseState, wipLimit: 1 }} />);
    expect(input.value).toBe('9');
    expect(defaultProps.onSetWipLimit).not.toHaveBeenCalled();
  });
  it('commits draft via onSetWipLimit when unmounted while focused (unmount-commit)', () => {
    const onSetWipLimit = vi.fn();
    const { unmount } = render(<StateRow {...defaultProps} onSetWipLimit={onSetWipLimit} />);
    const input = screen.getByLabelText(/WIP:/i) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '6' } });
    // Unmount while focused — WorkflowEditor switches Edit→View mid-edit
    unmount();
    expect(onSetWipLimit).toHaveBeenCalledWith(6);
  });
});
