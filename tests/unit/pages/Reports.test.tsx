import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../../src/pages/Shared/Reports';

const mockOrder = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockExportCsv = vi.hoisted(() => vi.fn());
const mockExportJson = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
  exportToJson: mockExportJson,
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
      expect(screen.getByText(`No visits on ${TODAY}`)).toBeInTheDocument();
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

  it('shows Export JSON button', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
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
});
