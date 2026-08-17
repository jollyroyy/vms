import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../../src/pages/Shared/Reports';

const mockOrder = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockExportCsv = vi.hoisted(() => vi.fn());
const mockAttachVisitActors = vi.hoisted(() => vi.fn((rows: any[]) => Promise.resolve(rows)));

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'gate_passes') {
        return { select: () => ({ eq: () => ({ in: mockIn }) }) };
      }
      // `[gte, lt)` on IST bounds — see Reports.test.tsx.
      return { select: () => ({ gte: () => ({ lt: () => ({ order: mockOrder }) }) }) };
    },
  },
}));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: mockAttachVisitActors,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('M12-REPORTS: Reports carrying material', () => {
  // Every timestamp is deliberately on a different day and at a different time,
  // so a column showing the wrong one cannot pass by coincidence.
  const timedVisit = {
    id: 'v6', ref_number: 'VIS-006', visitor_id: 'vis6', department_id: 'dept1', host_id: 'h1',
    status: 'checked_out' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
    checked_in_at: '2026-07-02T09:42:00Z', checked_out_at: '2026-07-03T17:30:00Z', exit_verified: true,
    rejection_reason: null, carrying_material: false, created_at: '2026-07-01T08:15:00Z',
    visitor: { id: 'vis6', full_name: 'Timed Visitor', phone: '9876543214', vendor_name: 'Test Corp' },
    department: { id: 'dept1', name: 'IT', code: 'IT' },
    host: { id: 'h1', full_name: 'Test Host' },
  };

  // The flag and the description are separate columns so an admin can scan the
  // yes/no down the page and still read what was actually brought in.
  it('renders Carrying and Carrying Remarks as two distinct columns', async () => {
    mockOrder.mockResolvedValue({ data: [timedVisit], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Carrying' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Carrying Remarks' })).toBeInTheDocument();
    });
  });

  it('shows the flag as Yes and the remarks in the guard\'s words', async () => {
    mockOrder.mockResolvedValue({
      data: [{ ...timedVisit, carrying_material: true, carrying_remarks: '1 Dell Latitude laptop, 2 Samsung phones' }],
      error: null,
    });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('1 Dell Latitude laptop, 2 Samsung phones')).toBeInTheDocument();
    });
  });

  it('says the remarks were not recorded for rows written before remarks existed', async () => {
    mockOrder.mockResolvedValue({
      data: [{ ...timedVisit, carrying_material: true, carrying_remarks: null }],
      error: null,
    });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('Not recorded')).toBeInTheDocument();
    });
  });

  it('shows No, not a blank cell, when nothing was carried', async () => {
    mockOrder.mockResolvedValue({
      data: [{ ...timedVisit, carrying_material: false, carrying_remarks: null }],
      error: null,
    });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument();
    });
  });
});
