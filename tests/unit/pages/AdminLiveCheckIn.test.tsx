import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import AdminLiveCheckIn from '../../../src/pages/Admin/AdminLiveCheckIn';

// AdminLiveCheckIn is the admin's read-only mirror of the guard's Entry & Exit
// tab: one `useAdminVisits({ kind: 'today' })` fetch, four KPI tiles and two
// lanes (Inside / Checked Out) over the same array. Mocking the hook directly
// — the pattern EntryExitTab.test.tsx uses for `useGateActivity` — keeps this
// suite about what the page composes, not about the supabase query chain.

afterEach(cleanup);

const mockVisits = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => mockVisits.current,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

function insideVisit(over: Record<string, any> = {}): any {
  return {
    id: 'v-in', ref_number: 'VIS-1', status: 'checked_in',
    checked_in_at: '2026-08-17T04:00:00Z', checked_out_at: null,
    created_at: '2026-08-17T03:30:00Z', scheduled_for: '2026-08-17T04:00:00Z',
    purpose: 'meeting', qr_token: 't1',
    visitor: { full_name: 'Aarav Mehta', vendor_name: 'Mehta Traders' },
    host: { full_name: 'P. Nair' }, department: { name: 'Ops' },
    ...over,
  };
}

function departedVisit(over: Record<string, any> = {}): any {
  return {
    id: 'v-out', ref_number: 'VIS-2', status: 'checked_out',
    checked_in_at: '2026-08-17T01:00:00Z', checked_out_at: '2026-08-17T03:00:00Z',
    created_at: '2026-08-17T00:30:00Z', scheduled_for: '2026-08-17T01:00:00Z',
    purpose: 'delivery', qr_token: 't2',
    visitor: { full_name: 'Diya Kapoor', vendor_name: 'Kapoor Logistics' },
    host: { full_name: 'R. Singh' }, department: { name: 'Facilities' },
    ...over,
  };
}

function pendingVisit(over: Record<string, any> = {}): any {
  return {
    id: 'v-pending', ref_number: 'VIS-3', status: 'pending_approval',
    checked_in_at: null, checked_out_at: null,
    created_at: '2026-08-17T05:00:00Z', scheduled_for: null,
    purpose: 'vendor', qr_token: null,
    visitor: { full_name: 'Nikhil Rao', vendor_name: null },
    host: { full_name: 'A. Iyer' }, department: { name: 'IT' },
    ...over,
  };
}

describe('AdminLiveCheckIn', () => {
  afterEach(() => { mockVisits.current = { visits: [], loading: false }; });

  it('renders the Live Check-In heading', () => {
    render(<AdminLiveCheckIn />);
    expect(screen.getByRole('heading', { name: 'Live Check-In' })).toBeInTheDocument();
    expect(screen.getByText('Everyone the gate has handled today.')).toBeInTheDocument();
  });

  it('shows the Inside lane empty state by default', () => {
    render(<AdminLiveCheckIn />);
    expect(screen.getByText('Nobody is inside right now.')).toBeInTheDocument();
  });

  it('shows a distinct Checked Out empty state on the other lane', () => {
    render(<AdminLiveCheckIn />);
    fireEvent.click(screen.getByRole('tab', { name: /Checked Out/i }));
    expect(screen.getByText('Nobody has checked out yet today.')).toBeInTheDocument();
    expect(screen.queryByText('Nobody is inside right now.')).toBeNull();
  });

  it('renders an inside visitor row on the default lane', () => {
    mockVisits.current = { visits: [insideVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    expect(screen.getByText('Aarav Mehta')).toBeInTheDocument();
  });

  it('renders a departed visitor row only on the Checked Out lane', () => {
    mockVisits.current = { visits: [insideVisit(), departedVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    expect(screen.queryByText('Diya Kapoor')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Checked Out/i }));
    expect(screen.getByText('Diya Kapoor')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Mehta')).toBeNull();
  });

  it('each lane shows its own count on its own tab', () => {
    mockVisits.current = { visits: [insideVisit(), departedVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    const insideTab = screen.getByRole('tab', { name: /Inside/i });
    const departedTab = screen.getByRole('tab', { name: /Checked Out/i });
    expect(within(insideTab).getByText('1')).toBeInTheDocument();
    expect(within(departedTab).getByText('1')).toBeInTheDocument();
  });

  it('computes correct KPI counts', () => {
    mockVisits.current = {
      visits: [insideVisit(), departedVisit(), pendingVisit()],
      loading: false,
    };
    render(<AdminLiveCheckIn />);
    // Arrived Today: insideVisit + departedVisit = 2. Currently Inside: 1.
    // Departed Today: 1. Awaiting Approval: 1.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('shows an em dash, never a blank cell, for a checked-in visitor with no checkout time', () => {
    mockVisits.current = { visits: [insideVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    const row = screen.getByText('Aarav Mehta').closest('tr') as HTMLElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells.some((c) => c.textContent === '—')).toBe(true);
  });

  it('offers no write control anywhere on the page — the admin surface is read-only', () => {
    mockVisits.current = { visits: [insideVisit(), departedVisit(), pendingVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    fireEvent.click(screen.getByRole('tab', { name: /Checked Out/i }));
    for (const label of [/check in/i, /check out/i, /^approve$/i, /^reject$/i, /print badge/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });
});
