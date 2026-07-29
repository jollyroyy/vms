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
        visitor: { id: 'vis1', full_name: 'Test Visitor', phone: '9876543210', company: 'Test Corp' },
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
        visitor: { id: 'vis2', full_name: 'Rejected Visitor', phone: '9876500000', company: 'Test Corp' },
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
      expect(screen.getByText('Rejected by Jane HOD (Host)')).toBeInTheDocument();
    });
  });

  it('shows walk-in approvals as "Pre-approved"/"Walk-in approved" without an actor', async () => {
    const mockVisits = [
      {
        id: 'v3', ref_number: 'VIS-003', visitor_id: 'vis3', department_id: 'dept1', host_id: 'h1',
        status: 'walkin_approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null,
        rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis3', full_name: 'Walkin Visitor', phone: '9876511111', company: 'Test Corp' },
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
});
