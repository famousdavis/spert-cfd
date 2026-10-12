// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CsvImportModal } from '../csv-import-modal';
import type { WorkflowState } from '@/types';

const workflow: WorkflowState[] = [
  { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
  { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 },
];

const onImport = vi.fn();
const onClose = vi.fn();

beforeEach(() => { vi.clearAllMocks(); });

function renderModal() {
  return render(
    <CsvImportModal workflow={workflow} snapshots={[]} onImport={onImport} onClose={onClose} />,
  );
}

function chooseFile(text: string, name = 'data.csv') {
  const input = document.getElementById('csv-import-file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([text], name, { type: 'text/csv' })] } });
}

describe('CsvImportModal — upload', () => {
  it('opens the file picker from a visible "Choose CSV file" button', () => {
    renderModal();
    const input = document.getElementById('csv-import-file') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose CSV file' }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('states the accepted date formats before a file is chosen', () => {
    renderModal();
    expect(screen.getByText(/Dates as YYYY-MM-DD or M\/D\/YYYY/)).toBeTruthy();
  });

  it('loads a dropped CSV file', async () => {
    renderModal();
    const file = new File(['Date,Backlog\n2026-10-05,3'], 'data.csv', { type: 'text/csv' });
    fireEvent.drop(screen.getByRole('dialog'), { dataTransfer: { files: [file] } });
    expect(await screen.findByText(/Map each CSV column/)).toBeTruthy();
  });

  it('rejects a dropped file that is not a CSV', () => {
    renderModal();
    const file = new File(['{}'], 'project.json', { type: 'application/json' });
    fireEvent.drop(screen.getByRole('dialog'), { dataTransfer: { files: [file] } });
    expect(screen.getByRole('alert').textContent).toContain('"project.json" is not a CSV file');
  });
});

describe('CsvImportModal — confirm', () => {
  it('offers no import when no date is recognized, and shows why', async () => {
    renderModal();
    chooseFile("Date,Backlog\n10/13/2026',5\n13/10/2026,4");
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(screen.getByRole('alert').textContent).toContain('Nothing can be imported');
    expect(screen.getByText(/2 rows skipped/).textContent).toContain(`"10/13/2026'", "13/10/2026"`);
    expect(screen.getByText(/Dates must be YYYY-MM-DD or M\/D\/YYYY/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Import/ })).toBeNull();
  });

  it('imports US-format dates as ISO and shows the date range', async () => {
    renderModal();
    chooseFile('Date,Backlog,Done\n10/5/2026,9,0\n10/30/2026,5,4');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(screen.getByText(/Dates: Oct 5, 2026 – Oct 30, 2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }));
    expect(onImport.mock.calls[0][0].map((s: { date: string }) => s.date)).toEqual([
      '2026-10-05',
      '2026-10-30',
    ]);
  });

  it('goes back to the mapping step', async () => {
    renderModal();
    chooseFile('Date,Backlog\n2026-10-05,3');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(/Map each CSV column/)).toBeTruthy();
  });
});
