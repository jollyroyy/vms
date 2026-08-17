import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSecurity from '../../../src/pages/Admin/AdminSecurity';

// AdminSecurity composes two live queries (useAdminVisits for today's visits,
// useVisitorDirectory for the visitors table) plus attachVisitActors, which
// all touch Supabase. Each is mocked at the module boundary, the same
// approach GuardDashboard.test.tsx takes with useTodayVisits — a channel mock
// is unnecessary here because the hooks themselves are replaced outright.

const mockVisits = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));
const mockVisitors = vi.hoisted(() => ({ current: { visitors: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => mockVisits.current,
}));
vi.mock('../../../src/lib/useVisitorDirectory', () => ({
  useVisitorDirectory: () => mockVisitors.current,
}));
vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: async (visits: any[]) => visits,
}));
vi.mock('../../../src/components/VisitorDetails', () => ({ default: () => null }));

const searchVisitorsForBlacklist = vi.fn(async () => [] as any[]);
const blacklistVisitor = vi.fn(async () => {});
vi.mock('../../../src/lib/adminBlacklist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/adminBlacklist')>();
  return {
    ...actual,
    searchVisitorsForBlacklist: (...args: any[]) => searchVisitorsForBlacklist(...args),
    blacklistVisitor: (...args: any[]) => blacklistVisitor(...args),
  };
});

function renderPage() {
  return render(<MemoryRouter><AdminSecurity /></MemoryRouter>);
}

function visitorRow(over: Record<string, any> = {}) {
  return {
    id: 'p1', phone: '9876543210', full_name: 'Priya Nair', vendor_name: null,
    id_type: null, id_last4: null, vehicle_number: null,
    is_blacklisted: true, blacklist_reason: 'Repeated policy violation',
    created_at: '2026-08-10T08:00:00Z',
    ...over,
  };
}

describe('AdminSecurity', () => {
  afterEach(() => {
    cleanup();
    mockVisits.current = { visits: [], loading: false };
    mockVisitors.current = { visitors: [], loading: false };
    searchVisitorsForBlacklist.mockClear();
    blacklistVisitor.mockClear();
  });

  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Blacklist & Security' })).toBeInTheDocument();
  });

  it('shows the empty state of every panel when there is nothing to show', () => {
    renderPage();
    expect(screen.getByText('No visitor is currently blacklisted.')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs attention today.')).toBeInTheDocument();
    expect(screen.getByText('No entry was denied today.')).toBeInTheDocument();
    // The Watchlist panel never fabricates a row — it says so honestly.
    expect(screen.getByText(/not recorded separately from the blacklist/i)).toBeInTheDocument();
  });

  it('renders a blacklisted visitor as an Active row with their reason', () => {
    mockVisitors.current = { visitors: [visitorRow()], loading: false };
    renderPage();
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.getByText('Repeated policy violation')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  // There is no `visitors` column for who set the flag, so the panel must
  // never print one — asserting the absence is the point of this test, not
  // an incidental check.
  it('never prints an "Added By" column', () => {
    mockVisitors.current = { visitors: [visitorRow()], loading: false };
    renderPage();
    expect(screen.queryByText(/added by/i)).toBeNull();
  });

  it('keeps the blacklist confirm disabled until a reason is typed', async () => {
    searchVisitorsForBlacklist.mockResolvedValueOnce([visitorRow({ is_blacklisted: false, blacklist_reason: null })]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /\+ Blacklist Visitor/i }));
    const confirmBefore = screen.getByRole('button', { name: 'Blacklist Visitor' });
    expect(confirmBefore).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/search phone or name/i), { target: { value: 'Priya' } });
    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Priya Nair'));

    const confirmNoReason = screen.getByRole('button', { name: 'Blacklist Visitor' });
    expect(confirmNoReason).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/why is this visitor being blacklisted/i), {
      target: { value: 'Attempted theft at the gate' },
    });
    expect(screen.getByRole('button', { name: 'Blacklist Visitor' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Blacklist Visitor' }));
    await waitFor(() => expect(blacklistVisitor).toHaveBeenCalledWith('p1', 'Attempted theft at the gate'));
  });

  // The admin surface is read-only for visitor records; this is the ONE
  // exception and it writes to `visitors`, never `visits`. No visit-state
  // control may appear anywhere on this page.
  it('offers no check-in, check-out or approval control', () => {
    mockVisits.current = {
      visits: [{
        id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
        status: 'rejected', checked_in_at: null, checked_out_at: null, exit_verified: null,
        rejection_reason: 'Not on the guest list', carrying_material: false,
        created_at: '2026-08-17T08:00:00Z', scheduled_for: null, purpose: 'meeting',
        visitor: { full_name: 'A. Kapoor', phone: '', vendor_name: null, is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '' },
        department: { name: 'HR' }, host: { full_name: 'S. Verma' },
      }],
      loading: false,
    };
    renderPage();
    expect(screen.queryByRole('button', { name: /check in/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /check out/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^reject$/i })).toBeNull();
  });
});
