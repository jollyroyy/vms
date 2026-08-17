import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import AdminPreRegistration from '../../../src/pages/Admin/AdminPreRegistration';

// AdminPreRegistration draws entirely off `useAdminVisits`, so the hook is
// mocked directly — the same pattern GuardDashboard.test.tsx uses for
// useTodayVisits: the page composes real logic (isPreRegistration,
// filterPreRegistrations, preRegKpis) over a seeded array, so seeding
// mockVisits is all a test needs.
const mockVisits = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => ({ visits: mockVisits.current, loading: false, error: null, reload: () => {} }),
}));

// The popup is read-only and unrelated to what this suite checks; stubbing it
// keeps the suite from pulling in VisitorDetails' own tree.
vi.mock('../../../src/components/VisitorDetails', () => ({
  default: () => null,
}));

function visitRow(over: Record<string, any> = {}): any {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null,
    status: 'approved', checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, qr_token: 'tok', qr_expires_at: null,
    invitation_sent_at: null,
    created_at: '2026-08-10T03:00:00Z', scheduled_for: '2026-08-20T09:30:00Z',
    visitor: {
      full_name: 'Priya Nair', phone: '9999900000', email: 'priya@example.com', vendor_name: null,
      is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '',
    },
    department: { name: 'HR' }, host: { full_name: 'S. Verma' },
    ...over,
  };
}

describe('AdminPreRegistration', () => {
  afterEach(() => {
    cleanup();
    mockVisits.current = [];
  });

  it('renders the page heading and blurb', () => {
    mockVisits.current = [];
    render(<AdminPreRegistration />);
    expect(screen.getByRole('heading', { name: 'Pre-Registration' })).toBeInTheDocument();
    expect(screen.getByText('Visitors booked in advance, over the period below.')).toBeInTheDocument();
  });

  // Client instruction 2026-08-17: every historical tab must say so, in a
  // chip beside the title (AdminPageHeader's `scope` prop).
  it('marks the tab historical', () => {
    mockVisits.current = [];
    render(<AdminPreRegistration />);
    expect(screen.getByText('Historical')).toBeInTheDocument();
  });

  // The range bar carries its own preset buttons and the resolved period —
  // this is the "date-wise + 7/30/60/90-day + 1-year" control the client
  // asked every historical tab to carry (AdminRangeBar.tsx).
  it('renders the date range bar with its preset buttons, defaulting to 30 days', () => {
    mockVisits.current = [];
    render(<AdminPreRegistration />);
    const group = screen.getByRole('group', { name: 'Date range' });
    expect(within(group).getByRole('button', { name: 'Last 30 Days' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Last 7 Days' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Last 60 Days' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Last 90 Days' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Last 1 Year' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Selected Day' })).toBeInTheDocument();
  });

  // Switching presets re-queries `useAdminVisits` with a new window rather
  // than crashing or freezing the table — the mock hook ignores its argument
  // and always returns the same seeded rows, so this proves the click and the
  // re-render survive, not that the fetch args changed (that is
  // useAdminVisits' own contract, not this page's).
  it('does not crash when a different preset is picked', () => {
    mockVisits.current = [visitRow({ id: 'a' })];
    render(<AdminPreRegistration />);
    fireEvent.click(screen.getByRole('button', { name: 'Last 90 Days' }));
    expect(screen.getByRole('button', { name: 'Last 90 Days' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
  });

  it('shows an empty state when there are no pre-registrations', () => {
    mockVisits.current = [];
    render(<AdminPreRegistration />);
    expect(screen.getByText('No pre-registered visitors match these filters.')).toBeInTheDocument();
  });

  it('renders a pre-registered row and excludes a walk-in from the loaded window', () => {
    mockVisits.current = [
      visitRow({ id: 'a', visitor: { ...visitRow().visitor, full_name: 'Priya Nair' } }),
      // A walk-in: no slot, and never reaches a pre-approval-only status.
      // isPreRegistration must drop it, so it should never render here even
      // though it came back on the same fetch.
      visitRow({
        id: 'w', status: 'pending_approval', scheduled_for: null,
        visitor: { ...visitRow().visitor, full_name: 'Walked In Wanda' },
      }),
    ];
    render(<AdminPreRegistration />);
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.queryByText('Walked In Wanda')).toBeNull();
  });

  it('counts the three KPI tiles correctly, over the pre-registration window', () => {
    mockVisits.current = [
      // Invited, still waiting on its date.
      visitRow({ id: 'a', invitation_sent_at: '2026-08-11T00:00:00Z' }),
      // Invited AND arrived (checked_in, scheduled_for set -> pre_approved origin).
      visitRow({
        id: 'b', invitation_sent_at: '2026-08-11T00:00:00Z',
        status: 'checked_in', checked_in_at: '2026-08-20T09:35:00Z',
      }),
      // Arrived and left — still "confirmed", never invited.
      visitRow({ id: 'c', status: 'checked_out', checked_in_at: '2026-08-19T09:35:00Z', checked_out_at: '2026-08-19T10:00:00Z' }),
      // Booked, never arrived.
      visitRow({ id: 'd', status: 'no_show' }),
      // A walk-in must never contribute to any of the three counts.
      visitRow({ id: 'w', status: 'pending_approval', scheduled_for: null, invitation_sent_at: '2026-08-11T00:00:00Z' }),
    ];
    render(<AdminPreRegistration />);
    const invites = screen.getByText('Invites Sent').closest('div')!;
    expect(within(invites).getByText('2')).toBeInTheDocument();
    const confirmed = screen.getByText('Confirmed').closest('div')!;
    expect(within(confirmed).getByText('2')).toBeInTheDocument();
    const noShows = screen.getByText('No-shows').closest('div')!;
    expect(within(noShows).getByText('1')).toBeInTheDocument();
  });

  it('narrows the list when a host is selected', () => {
    mockVisits.current = [
      visitRow({ id: 'a', host: { full_name: 'S. Verma' }, visitor: { ...visitRow().visitor, full_name: 'Amit Rao' } }),
      visitRow({ id: 'b', host: { full_name: 'K. Iyer' }, visitor: { ...visitRow().visitor, full_name: 'Bina Shah' } }),
    ];
    render(<AdminPreRegistration />);
    expect(screen.getByText('Amit Rao')).toBeInTheDocument();
    expect(screen.getByText('Bina Shah')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'K. Iyer' } });

    expect(screen.queryByText('Amit Rao')).toBeNull();
    expect(screen.getByText('Bina Shah')).toBeInTheDocument();
  });

  it('reports the right "Showing X to Y of N entries" and pages through the list', () => {
    mockVisits.current = Array.from({ length: 11 }, (_, i) =>
      visitRow({ id: `row-${i}`, visitor: { ...visitRow().visitor, full_name: `Visitor ${i}` } }),
    );
    render(<AdminPreRegistration />);
    expect(screen.getByText('Showing 1 to 10 of 11 entries')).toBeInTheDocument();
    expect(screen.getByText('Visitor 0')).toBeInTheDocument();
    expect(screen.queryByText('Visitor 10')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 11 to 11 of 11 entries')).toBeInTheDocument();
    expect(screen.getByText('Visitor 10')).toBeInTheDocument();
  });

  // The whole admin surface is read-only for visitor records (2026-08-17
  // instruction): no control on this tab may write to `visits`.
  it('offers no control that writes to a visit', () => {
    mockVisits.current = [visitRow({ id: 'a' })];
    render(<AdminPreRegistration />);
    for (const btn of screen.queryAllByRole('button')) {
      expect(btn.textContent).not.toMatch(/check in|check out|^approve$|^reject$/i);
    }
    expect(screen.queryByText(/^invite visitor$/i)).toBeNull();
  });
});
