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
      return { select: () => ({ gte: () => ({ lte: () => ({ order: mockOrder }) }) }) };
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

const TODAY = new Date().toISOString().slice(0, 10);

describe('M12-REPORTS: Reports', () => {
  it('renders title', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });
  });

  it('shows date range inputs', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Date:')).toBeInTheDocument();
    });
  });

  it('shows empty state when no visits found', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(`No visits between ${TODAY} and ${TODAY}`)).toBeInTheDocument();
    });
  });

  it('shows range preset buttons', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Last 7 Days' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Last 30 Days' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Last 3 Months' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Last 1 Year' })).toBeInTheDocument();
    });
  });

  it('shows Export CSV button', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
    });
  });

  it('renders visit rows when data is returned', async () => {
    const mockVisits = [
      {
        id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
        status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: new Date().toISOString(), checked_out_at: null, exit_verified: null,
        rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis1', full_name: 'Test Visitor', phone: '9876543210', vendor_name: 'Test Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Test Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Test Visitor')).toBeInTheDocument();
    });
  });

  it('shows who rejected a visit, with their name and role', async () => {
    const mockVisits = [
      {
        id: 'v2', ref_number: 'VIS-002', visitor_id: 'vis2', department_id: 'dept1', host_id: 'h1',
        status: 'rejected' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null,
        rejection_reason: 'Not expected', carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis2', full_name: 'Rejected Visitor', phone: '9876500000', vendor_name: 'Test Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Test Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockAttachVisitActors.mockImplementationOnce((rows: any[]) =>
      Promise.resolve(rows.map((r) => ({ ...r, actor: { name: 'Jane HOD', role: 'hod' } }))),
    );
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Rejected by Jane HOD (Person to Meet)')).toBeInTheDocument();
    });
  });

  it('shows walk-in approvals as "Pre-approved"/"Walk-in approved" without an actor', async () => {
    const mockVisits = [
      {
        id: 'v3', ref_number: 'VIS-003', visitor_id: 'vis3', department_id: 'dept1', host_id: 'h1',
        status: 'walkin_approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null,
        rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis3', full_name: 'Walkin Visitor', phone: '9876511111', vendor_name: 'Test Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Test Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Walk-in approved')).toBeInTheDocument();
    });
  });

  it('shows visitor photo when photo_data is present', async () => {
    const mockVisits = [
      {
        id: 'v4', ref_number: 'VIS-004', visitor_id: 'vis4', department_id: 'dept1', host_id: 'h1',
        status: 'checked_in' as const, purpose: 'meeting' as const, photo_path: null, photo_data: 'data:image/png;base64,AAAA',
        checked_in_at: '2026-07-01T09:42:00Z', checked_out_at: '2026-07-02T17:30:00Z', exit_verified: true,
        rejection_reason: null, carrying_material: false, created_at: '2026-07-01T08:00:00Z',
        visitor: { id: 'vis4', full_name: 'Photo Visitor', phone: '9876543212', vendor_name: 'Test Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Test Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByAltText('Visitor photo')).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    });
  });

  it('masks ID proof to the last two characters only', async () => {
    const mockVisits = [
      {
        id: 'v5', ref_number: 'VIS-005', visitor_id: 'vis5', department_id: 'dept1', host_id: 'h1',
        status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null,
        rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis5', full_name: 'Id Visitor', phone: '9876543213', vendor_name: 'Test Corp', id_type: 'Aadhaar', id_last4: '9646' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Test Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Aadhaar ••••46')).toBeInTheDocument();
    });
    expect(screen.queryByText('9646')).not.toBeInTheDocument();
  });

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

  const asDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
  const asTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN');

  it('shows exact check-in and check-out date & time', async () => {
    mockOrder.mockResolvedValue({ data: [timedVisit], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(asDate('2026-07-02T09:42:00Z'))).toBeInTheDocument();
    });
    expect(screen.getByText(asTime('2026-07-02T09:42:00Z'))).toBeInTheDocument();
    expect(screen.getByText(asDate('2026-07-03T17:30:00Z'))).toBeInTheDocument();
    expect(screen.getByText(asTime('2026-07-03T17:30:00Z'))).toBeInTheDocument();
  });

  it('shows the exact approval date & time from the audit trail', async () => {
    mockOrder.mockResolvedValue({ data: [timedVisit], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockAttachVisitActors.mockImplementationOnce((rows: any[]) =>
      Promise.resolve(rows.map((r) => ({ ...r, approvedAt: '2026-06-30T14:05:00Z' }))),
    );
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(asDate('2026-06-30T14:05:00Z'))).toBeInTheDocument();
    });
    expect(screen.getByText(asTime('2026-06-30T14:05:00Z'))).toBeInTheDocument();
  });

  // A pre-approval is INSERTed already approved, so no audit row is ever
  // written for it and created_at is the approval instant.
  it('falls back to created_at as the approval time when no audit row exists', async () => {
    mockOrder.mockResolvedValue({ data: [timedVisit], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(asDate('2026-07-01T08:15:00Z'))).toBeInTheDocument();
    });
    expect(screen.getByText(asTime('2026-07-01T08:15:00Z'))).toBeInTheDocument();
  });

  it('leaves the approval column blank for a visit still awaiting approval', async () => {
    mockOrder.mockResolvedValue({
      data: [{ ...timedVisit, status: 'pending_approval' as const, checked_in_at: null, checked_out_at: null }],
      error: null,
    });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Timed Visitor')).toBeInTheDocument();
    });
    expect(screen.queryByText(asDate('2026-07-01T08:15:00Z'))).not.toBeInTheDocument();
  });

  // Premium type-scale pass (2026-08-10): register headers sit at the micro
  // scale (11px/600 uppercase) and every numeral column stays tabular so
  // digits never jitter as rows load or filter.
  it('renders the register header at the micro scale and keeps numerals tabular', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Visitor Name')).toBeInTheDocument();
    });
    const header = screen.getByText('Visitor Name');
    expect(header.tagName).toBe('TH');
    expect(header.className).toContain('text-micro');
    const table = header.closest('table')!;
    expect(table.className).toContain('tabular-nums');
  });
});
