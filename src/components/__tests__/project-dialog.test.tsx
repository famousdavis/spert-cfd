// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R1a): the one project dialog (SPERT® Forecaster's
// ProjectDialog) and the Delete confirmation close on Escape and on nothing
// else's Escape: a surface behind them (the import preview) listens on
// `document` in the bubble phase, and one Escape used to reach it too. jsdom
// does not enforce `inert`, so the attribute is checked; focus after close in a
// real browser is measured (evidence P7).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectDialog } from '../project-dialog';
import { ConfirmDialog } from '../confirm-dialog';

let bubbleSpy: ReturnType<typeof vi.fn<() => void>>;
let spyHandler: (e: KeyboardEvent) => void;
function listenBehind() {
  bubbleSpy = vi.fn<() => void>();
  spyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') bubbleSpy(); };
  document.addEventListener('keydown', spyHandler);
}
afterEach(() => document.removeEventListener('keydown', spyHandler));

function renderDialog(over: Partial<Parameters<typeof ProjectDialog>[0]> = {}) {
  const opener = document.createElement('button');
  opener.textContent = 'Opener';
  document.body.appendChild(opener);
  const props = {
    identity: 'new',
    title: 'New Project',
    initialName: '',
    submitLabel: 'Create',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    returnFocusTo: () => opener,
    ...over,
  };
  const view = render(<p>The page</p>);
  view.rerender(<><p>The page</p><ProjectDialog {...props} /></>);
  return { props, opener, view };
}

describe('ProjectDialog', () => {
  it('is a 560 px dialog named by its title, with Project Name focused', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'New Project' });
    expect(dialog.className).toContain('max-w-[560px]');
    expect(document.activeElement).toBe(screen.getByLabelText('Project Name'));
  });

  it('makes the page behind inert while open, and only for as long as it is open', () => {
    const { props, view, opener } = renderDialog();
    const page = view.container;
    expect(page.hasAttribute('inert')).toBe(true);
    expect(opener.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
    view.rerender(<p>The page</p>);
    expect(page.hasAttribute('inert')).toBe(false);
    expect(opener.hasAttribute('inert')).toBe(false);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('returns focus where the caller says once it has closed (after inert is removed)', () => {
    const { view, opener } = renderDialog();
    view.rerender(<p>The page</p>);
    expect(document.activeElement).toBe(opener);
  });

  it('Escape cancels it, and never reaches a listener behind it', () => {
    listenBehind();
    const { props } = renderDialog();
    fireEvent.keyDown(screen.getByLabelText('Project Name'), { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(bubbleSpy).not.toHaveBeenCalled();
  });

  it('Edit starts with the name selected; Update submits the trimmed name', () => {
    const { props } = renderDialog({ identity: 'p1', title: 'Edit Project', initialName: 'Alpha', submitLabel: 'Update' });
    const input = screen.getByLabelText('Project Name') as HTMLInputElement;
    expect(input.value).toBe('Alpha');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    fireEvent.change(input, { target: { value: '  Beta  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(props.onSubmit).toHaveBeenCalledWith('Beta');
  });

  it('Tab from the last control wraps to the first, and Shift+Tab from the first to the last', () => {
    renderDialog({ initialName: 'X' });
    const input = screen.getByLabelText('Project Name');
    const create = screen.getByRole('button', { name: 'Create' });
    create.focus();
    fireEvent.keyDown(create, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(create);
  });

  it('its field passes form hygiene: id, name, a label, no autofill', () => {
    renderDialog();
    const input = screen.getByLabelText('Project Name') as HTMLInputElement;
    expect(input.id).not.toBe('');
    expect(input.name).toBe('projectName');
    expect(input.autocomplete).toBe('off');
    expect(input.maxLength).toBe(200);
  });
});

describe('ConfirmDialog (the Delete confirmation, D2)', () => {
  it('Escape cancels it, and never reaches a listener behind it', () => {
    listenBehind();
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Delete Project" message="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(bubbleSpy).not.toHaveBeenCalled();
  });
});
