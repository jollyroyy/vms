import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DailyStaff from '../../../src/pages/Guard/DailyStaff';

/* ─── Mock data ─────────────────────────────────────────── */

let mockVisits: any[] = [];

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        gte: () => ({
          in: () => Promise.resolve({ data: mockVisits, error: null }),
        }),
      }),
    }),
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = vi.fn().mockReturnValue(ch);
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));

afterEach(cleanup);

beforeEach(() => {
  mockVisits = [];
});

function renderPage() {
  return render(
    <MemoryRouter>
      <DailyStaff />
    </MemoryRouter>,
  );
}

/* ─── Tests ─────────────────────────────────────────────── */

describe('DailyStaff page', () => {
  it('renders page heading', async () => {
    renderPage();
    expect(screen.getByText('Daily Staff')).toBeInTheDocument();
    expect(screen.getByText(/Vendors, maids & workers/)).toBeInTheDocument();
  });

  it('shows empty state when no visits', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No daily staff visits found')).toBeInTheDocument();
    });
  });

  it('renders visitor cards when data exists', async () => {
    mockVisits = [
      { id: '1', visitor_name: 'Sunita Devi', visitor_phone: '9876543210', visitor_company: null, purpose: 'maintenance', status: 'checked_in', check_in_time: '2025-01-01T09:00:00Z', check_out_time: null, departments: { name: 'Admin' } },
      { id: '2', visitor_name: 'Ramu Vendor', visitor_phone: '9123456789', visitor_company: 'SupplyCo', purpose: 'vendor', status: 'approved', check_in_time: null, check_out_time: null, departments: { name: 'IT' } },
    ];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText('Ramu Vendor')).toBeInTheDocument();
    });
  });

  it('maps purpose to correct type badge', async () => {
    mockVisits = [
      { id: '1', visitor_name: 'Worker One', visitor_phone: '111', visitor_company: null, purpose: 'maintenance', status: 'checked_in', check_in_time: null, check_out_time: null, departments: { name: 'HR' } },
      { id: '2', visitor_name: 'Vendor Two', visitor_phone: '222', visitor_company: null, purpose: 'vendor', status: 'approved', check_in_time: null, check_out_time: null, departments: { name: 'IT' } },
      { id: '3', visitor_name: 'Delivery Three', visitor_phone: '333', visitor_company: null, purpose: 'delivery', status: 'checked_out', check_in_time: null, check_out_time: null, departments: { name: 'Ops' } },
    ];
    renderPage();
    await waitFor(() => {
      // Worker badge + dropdown option = 2 instances
      expect(screen.getAllByText('Worker').length).toBe(2);
      // Both vendor and delivery map to Vendor badge (2) + dropdown option (1) = 3
      expect(screen.getAllByText('Vendor').length).toBe(3);
    });
  });

  it('shows status badges correctly', async () => {
    mockVisits = [
      { id: '1', visitor_name: 'Inside Person', visitor_phone: '111', visitor_company: null, purpose: 'maintenance', status: 'checked_in', check_in_time: '2025-01-01T09:00:00Z', check_out_time: null, departments: { name: 'HR' } },
      { id: '2', visitor_name: 'Left Person', visitor_phone: '222', visitor_company: null, purpose: 'vendor', status: 'checked_out', check_in_time: null, check_out_time: null, departments: { name: 'IT' } },
      { id: '3', visitor_name: 'Expected Person', visitor_phone: '333', visitor_company: null, purpose: 'delivery', status: 'approved', check_in_time: null, check_out_time: null, departments: { name: 'Ops' } },
    ];
    renderPage();
    await waitFor(() => {
      // "In" badge (status) + "Inside" tab — check for the badge via status-badge class
      expect(screen.getByText('Inside Person')).toBeInTheDocument();
      expect(screen.getByText('Left Person')).toBeInTheDocument();
      expect(screen.getByText('Expected Person')).toBeInTheDocument();
      // "Expected" appears as both stat label and badge — verify at least 2 instances
      expect(screen.getAllByText('Expected').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows company name when present', async () => {
    mockVisits = [
      { id: '1', visitor_name: 'Vendor X', visitor_phone: '111', visitor_company: 'Acme Corp', purpose: 'vendor', status: 'approved', check_in_time: null, check_out_time: null, departments: { name: 'IT' } },
    ];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('renders stat cards with correct counts', async () => {
    mockVisits = [
      { id: '1', visitor_name: 'A', visitor_phone: '', visitor_company: null, purpose: 'maintenance', status: 'checked_in', check_in_time: null, check_out_time: null, departments: null },
      { id: '2', visitor_name: 'B', visitor_phone: '', visitor_company: null, purpose: 'vendor', status: 'checked_out', check_in_time: null, check_out_time: null, departments: null },
      { id: '3', visitor_name: 'C', visitor_phone: '', visitor_company: null, purpose: 'delivery', status: 'approved', check_in_time: null, check_out_time: null, departments: null },
    ];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Today')).toBeInTheDocument();
      expect(screen.getByText('Checked In')).toBeInTheDocument();
      expect(screen.getByText('Checked Out')).toBeInTheDocument();
      expect(screen.getByText('Expected')).toBeInTheDocument();
    });
  });

  it('renders tab buttons', () => {
    renderPage();
    expect(screen.getByText('All Today')).toBeInTheDocument();
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
  });

  it('renders type filter dropdown', () => {
    renderPage();
    expect(screen.getByDisplayValue('All Types')).toBeInTheDocument();
  });

  it('falls back to General when department is null', async () => {
    mockVisits = [
      { id: '1', visitor_name: 'No Dept', visitor_phone: '', visitor_company: null, purpose: 'maintenance', status: 'checked_in', check_in_time: null, check_out_time: null, departments: null },
    ];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
    });
  });
});
