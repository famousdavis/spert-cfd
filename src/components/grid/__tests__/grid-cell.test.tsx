// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridCell } from '../grid-cell';

const defaultProps = {
  fieldId: 'test-cell',
  value: 5,
  onChange: vi.fn(),
  onKeyDown: vi.fn(),
  inputRef: vi.fn(),
  isWipViolation: false,
  ariaLabel: 'Test cell',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('GridCell — A3 draft buffer', () => {
  it('does NOT call onChange while typing (only on blur)', () => {
    render(<GridCell {...defaultProps} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.change(input, { target: { value: '100' } });
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
  it('calls onChange with draft value on blur', () => {
    render(<GridCell {...defaultProps} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledOnce();
    expect(defaultProps.onChange).toHaveBeenCalledWith(42);
  });
  it('calls onChange with draft value on Enter', () => {
    render(<GridCell {...defaultProps} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onChange).toHaveBeenCalledWith(7);
  });
  it('ignores incoming value prop updates while focused (focus guard)', () => {
    const { rerender } = render(<GridCell {...defaultProps} value={5} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    rerender(<GridCell {...defaultProps} value={3} />);
    expect(input.value).toBe('99');
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
  it('updates from prop when NOT focused', () => {
    const { rerender } = render(<GridCell {...defaultProps} value={5} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    rerender(<GridCell {...defaultProps} value={8} />);
    expect(input.value).toBe('8');
  });
  it('passes onKeyDown through for grid navigation on non-Enter keys', () => {
    render(<GridCell {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Tab' });
    expect(defaultProps.onKeyDown).toHaveBeenCalledOnce();
  });
  it('also passes onKeyDown through on Enter', () => {
    render(<GridCell {...defaultProps} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onKeyDown).toHaveBeenCalled();
  });
  it('normalizes invalid input to 0', () => {
    render(<GridCell {...defaultProps} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledWith(0);
  });
  it('commits draft via onChange when unmounted while focused (unmount-commit)', () => {
    const onChange = vi.fn();
    const { unmount } = render(<GridCell {...defaultProps} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '77' } });
    // Unmount while focused — blur never fires
    unmount();
    expect(onChange).toHaveBeenCalledWith(77);
  });
});
