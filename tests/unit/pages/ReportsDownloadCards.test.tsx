import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ReportsDownloadCards from '../../../src/pages/Shared/ReportsDownloadCards';

// The four standing CSV reports, as cards.
//
// NO ROW COUNT ON THE BUTTON (client instruction, 2026-08-17). "Download report
// (137)" put a number where a number reads as part of the control, and the four
// counts are different units — days, hosts, hours, bad outcomes — so four bare
// integers side by side invited a comparison they do not support. What the count
// was load-bearing for, telling an empty range apart from a working one, is the
// disabled state and its sentence, which is what this file pins.

const mockExportCsv = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/exportUtils', () => ({ exportToCsv: mockExportCsv }));

function visit(over: Record<string, any> = {}): any {
  return {
    id: 'v1', ref_number: 'VIS-20260817-0001', visitor_id: 'p1', department_id: 'd1',
    host_id: 'h1', status: 'checked_in', purpose: 'meeting',
    checked_in_at: '2026-08-17T04:00:00Z', checked_out_at: null,
    scheduled_for: '2026-08-17T04:00:00Z', created_at: '2026-08-17T03:00:00Z',
    checkin_duration_seconds: 40, carrying_material: false,
    visitor: { full_name: 'Ramesh Kumar', phone: '9000000000', vendor_name: 'Acme' },
    department: { name: 'HR' }, host: { full_name: 'S. Verma' },
    ...over,
  };
}

afterEach(() => { cleanup(); mockExportCsv.mockClear(); });

describe('ReportsDownloadCards', () => {
  it('labels every enabled button "Download report" with no count in it', () => {
    render(<ReportsDownloadCards visits={[visit()]} from="2026-08-17" to="2026-08-17" filenameSuffix="2026-08-17" />);

    const buttons = screen.getAllByRole('button', { name: 'Download report' });
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toBeEnabled();
    // The parenthesised count is the specific thing removed.
    expect(screen.queryByRole('button', { name: /Download report \(\d+\)/ })).toBeNull();
  });

  it('names the four reports', () => {
    render(<ReportsDownloadCards visits={[visit()]} from="2026-08-17" to="2026-08-17" filenameSuffix="2026-08-17" />);
    for (const title of ['Monthly Visitor Summary', 'Host Activity Report',
      'Peak Hours Analysis', 'No-show & Overstay Report']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('disables a report with nothing in the range and says so instead of offering an empty file', () => {
    render(<ReportsDownloadCards visits={[]} from="2026-08-17" to="2026-08-17" filenameSuffix="2026-08-17" />);
    // Host activity, peak hours and no-show/overstay all yield no rows for an
    // empty range; the monthly summary still carries one zero row per day, which
    // is deliberate (a day with no visitors is a fact, not a missing point).
    const empties = screen.getAllByRole('button', { name: 'Nothing in this range' });
    expect(empties).toHaveLength(3);
    for (const b of empties) expect(b).toBeDisabled();
  });

  it('exports through exportToCsv with the range in the filename', () => {
    render(<ReportsDownloadCards visits={[visit()]} from="2026-08-17" to="2026-08-17" filenameSuffix="2026-08-17" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Download report' })[0]);
    expect(mockExportCsv).toHaveBeenCalledTimes(1);
    expect(mockExportCsv.mock.calls[0][1]).toBe('visitor-summary-2026-08-17.csv');
  });
});
