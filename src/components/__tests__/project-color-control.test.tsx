// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R2, O57; P6): the Tile color button and popover, as
// SPERT® Forecaster's tests pin them, and Escape with an import waiting.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useEscapeKey } from '@/lib/use-dismiss';
import type { ProjectColor } from '@/lib/project-prefs';
import { ProjectColorButton, ProjectColorPopover } from '../project-color-control';

function Harness({ onPick = () => true, importWaiting = false, onImportCancel = () => {} }: { onPick?: (c: ProjectColor | null) => boolean; importWaiting?: boolean; onImportCancel?: () => void }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<ProjectColor | undefined>('teal');
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div>
      {importWaiting && <ImportPreview onCancel={onImportCancel} />}
      <ProjectColorButton projectName="Alpha" color={color} open={open} buttonRef={ref} onOpenChange={setOpen} disabledReason={null} />
      {open && (
        <ProjectColorPopover
          color={color}
          buttonRef={ref}
          onPick={(c) => {
            if (!onPick(c)) return false;
            setColor(c ?? undefined);
            return true;
          }}
          onOpenChange={setOpen}
        />
      )}
      <button type="button">Elsewhere</button>
    </div>
  );
}

/** Stands for the Projects tab's import preview: it listens for Escape as `import-preview-section.tsx` does. */
function ImportPreview({ onCancel }: { onCancel: () => void }) {
  useEscapeKey(onCancel);
  return <section aria-label="Import preview" />;
}

const colorButton = () => screen.getByRole('button', { name: /^Tile color for Alpha/ });
const openPopover = () => fireEvent.click(colorButton());

describe('the popover', () => {
  it('opens with focus on the checked colour, named and labelled', () => {
    render(<Harness />);
    expect(colorButton().getAttribute('aria-label')).toBe('Tile color for Alpha: Teal');
    expect(colorButton().getAttribute('aria-expanded')).toBe('false');
    openPopover();
    expect(screen.getByRole('dialog', { name: 'Tile color' })).toBeTruthy();
    expect(colorButton().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Teal' }));
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual(['Blue', 'Teal', 'Slate', 'Purple', 'Pink', 'No color']);
  });

  it('a keyboard change applies at once and stays open; Enter closes and focus returns to the button', () => {
    render(<Harness />);
    openPopover();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Teal' }), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('radio', { name: 'Slate' })); // the arrow's change, as the browser fires it
    expect(colorButton().getAttribute('aria-label')).toBe('Tile color for Alpha: Slate');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Slate' }), { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(colorButton());
  });

  it('a pointer pick applies, closes and returns focus to the button; re-picking the current colour closes too', () => {
    render(<Harness />);
    openPopover();
    const pink = screen.getByRole('radio', { name: 'Pink' });
    fireEvent.pointerDown(pink.closest('label')!);
    fireEvent.click(pink);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(colorButton().getAttribute('aria-label')).toBe('Tile color for Alpha: Pink');
    expect(document.activeElement).toBe(colorButton());
    openPopover();
    const same = screen.getByRole('radio', { name: 'Pink' });
    fireEvent.pointerDown(same.closest('label')!);
    fireEvent.click(same);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a refused pick changes nothing: the checked colour stays and focus goes back to it', () => {
    render(<Harness onPick={() => false} />);
    openPopover();
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(colorButton().getAttribute('aria-label')).toBe('Tile color for Alpha: Teal');
    expect((screen.getByRole('radio', { name: 'Teal' }) as HTMLInputElement).checked).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Teal' }));
  });

  it('Tab out closes it, focus staying where it went; a press outside closes it', () => {
    render(<Harness />);
    openPopover();
    fireEvent.blur(screen.getByRole('radio', { name: 'Teal' }), { relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }) });
    expect(screen.queryByRole('dialog')).toBeNull();
    openPopover();
    act(() => {
      screen.getByRole('button', { name: 'Elsewhere' }).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Escape (O57)', () => {
  it('closes the popover and returns focus to its button', () => {
    render(<Harness />);
    openPopover();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(colorButton());
  });

  it('with an import waiting, one Escape closes only the popover; the next one reaches the import', () => {
    const cancelImport = vi.fn();
    render(<Harness importWaiting onImportCancel={cancelImport} />);
    openPopover();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cancelImport).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(cancelImport).toHaveBeenCalledTimes(1);
  });
});

it('a disabled button says why', () => {
  const ref = { current: null };
  render(<ProjectColorButton projectName="Alpha" color={undefined} open={false} buttonRef={ref} onOpenChange={() => {}} disabledReason="Not now" />);
  const b = screen.getByRole('button', { name: 'Tile color for Alpha: No color' }) as HTMLButtonElement;
  expect(b.disabled).toBe(true);
  expect(b.title).toBe('Not now');
});
