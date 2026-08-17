import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import AdminDashboard from '../../../src/pages/Admin/AdminDashboard';

// AdminDashboard draws its six KPI tiles, the flow/purpose charts, the lobby
// feed and Top Hosts entirely off useAdminVisits + useVisitFeedback (one
// query feeds all six panels, per the file's own header comment). Mocking
// both hooks directly — the GuardDashboard.test.tsx pattern — keeps this
// suite about adminKpis/hourlyFlow/purposeSplit/topHosts/lobbyFeed as
// composed on screen, not about the supabase query chain.
//
// `now` is `useMemo(() => new Date(), [])` inside the component, i.e. it is
// whatever the system clock reads at mount — so every test pins the clock
// with vi.setSystemTime before rendering, per the task's fixed-date rule.

const mockVisits = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));
const mockFeedback = vi.hoisted(() => ({ current: { feedback: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => mockVisits.current,
}));
vi.mock('../../../src/lib/useVisitFeedback', () => ({
  useVisitFeedback: () => mockFeedback.current,
}));
// Read-only popup, irrelevant to what this suite checks.
vi.mock('../../../src/components/VisitorDetails', () => ({ default: () => null }));

const NOW = '2026-08-17T12:00:00Z'; // IST 17:30, 2026-08-17

function visitRow(over: Record<string, any> = {}): any {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    status: 'checked_in', checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, qr_token: 'tok', qr_expires_at: null,
    created_at: '2026-08-17T02:00:00Z', scheduled_for: null, purpose: 'meeting',
    checkin_duration_seconds: null, expected_departure: null,
    visitor: { full_name: 'Someone', phone: '', vendor_name: null, is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '' },
    department: { name: 'HR' }, host: { full_name: 'A Host' },
    ...over,
  };
}

function renderPage() {
  return render(<AdminDashboard />);
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    mockVisits.current = { visits: [], loading: false };
    mockFeedback.current = { feedback: [], loading: false };
  });

  it('renders no level-1 heading — the sidebar item already says "Dashboard"', () => {
    renderPage();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows an honest empty caption on every tile when there is no data, never a fabricated number', () => {
    renderPage();
    expect(screen.getByText('No arrivals yesterday to compare')).toBeInTheDocument();
    expect(screen.getByText('No check-in was timed today')).toBeInTheDocument();
    expect(screen.getByText('No visitor has rated today')).toBeInTheDocument();
    expect(screen.getByText('Nobody is overdue')).toBeInTheDocument();
    // Value cells for the two unmeasured tiles read words, not invented numbers.
    expect(screen.getByText('Not measured')).toBeInTheDocument();
    expect(screen.getByText('No ratings')).toBeInTheDocument();
  });

  it('shows each chart\'s own empty message rather than a blank box', () => {
    renderPage();
    // The purpose donut, the lobby feed and Top Hosts have genuinely nothing
    // to plot with no visits, and say so.
    expect(screen.getByText('No arrivals to break down yet.')).toBeInTheDocument();
    expect(screen.getByText('No visitor has come through the gate today.')).toBeInTheDocument();
    expect(screen.getByText('No arrivals today, so there is nobody to rank.')).toBeInTheDocument();
    // hourlyFlow always returns one bucket per hour 08:00–18:00, valued zero —
    // the same "a quiet hour is a fact, not a missing point" rule BarChart
    // documents — so the flow line must NOT show the empty-chart message.
    expect(screen.queryByText('Nobody has checked in yet today.')).toBeNull();
  });

  it('computes all six tile values correctly, ranks Top Hosts and orders the lobby feed by most-recent arrival', () => {
    mockVisits.current = {
      visits: [
        // Today, Asha Rao's two: one measured pre-approval, one unmeasured walk-in.
        // host_id is distinct per host — topHosts keys on it, not the name.
        visitRow({
          id: 'v1', host_id: 'hostA', visitor: { ...visitRow().visitor, full_name: 'Priya Nair' },
          checked_in_at: '2026-08-17T09:00:00Z', scheduled_for: '2026-08-17T09:00:00Z',
          host: { full_name: 'Asha Rao' }, purpose: 'meeting', checkin_duration_seconds: 120,
        }),
        visitRow({
          id: 'v2', host_id: 'hostA', visitor: { ...visitRow().visitor, full_name: 'Rahul Sen' },
          checked_in_at: '2026-08-17T10:00:00Z', scheduled_for: null,
          host: { full_name: 'Asha Rao' }, purpose: 'delivery', checkin_duration_seconds: null,
        }),
        // Today, Ben Iyer's one — pre-approved, measured.
        visitRow({
          id: 'v3', host_id: 'hostB', visitor: { ...visitRow().visitor, full_name: 'Meera Iyer' },
          checked_in_at: '2026-08-17T08:00:00Z', scheduled_for: '2026-08-17T08:00:00Z',
          host: { full_name: 'Ben Iyer' }, purpose: 'meeting', checkin_duration_seconds: 180,
        }),
        // Yesterday, already left.
        visitRow({
          id: 'v4', host_id: 'hostC', status: 'checked_out',
          checked_in_at: '2026-08-16T09:00:00Z', checked_out_at: '2026-08-16T10:00:00Z',
          host: { full_name: 'Cy Dutta' },
        }),
        // Yesterday, still checked in and now past its 12h deadline — overstaying.
        visitRow({
          id: 'v5', host_id: 'hostD', checked_in_at: '2026-08-16T16:00:00Z',
          host: { full_name: 'Dee Kapoor' },
        }),
      ],
      loading: false,
    };
    mockFeedback.current = { feedback: [{ rating: 4 }, { rating: 5 }], loading: false };

    renderPage();

    // 3 arrived today; 2 arrived yesterday (v4, v5) -> +50%. The tile reads
    // "Total Visitors", not "Visitors Today" — the day is stated once by the
    // "Today at a Glance" header above the board (client instruction,
    // 2026-08-17) — and not a bare "Visitors" either, which would collide with
    // the flow chart's series name and the Top Hosts count column.
    const visitorsToday = screen.getByText('Total Visitors').closest('div')!;
    expect(within(visitorsToday).getByText('3')).toBeInTheDocument();
    expect(within(visitorsToday).getByText(/50% vs yesterday/)).toBeInTheDocument();

    // Currently Inside: every row still status checked_in = v1, v2, v3, v5 = 4.
    const inside = screen.getByText('Currently Inside').closest('div')!;
    expect(within(inside).getByText('4')).toBeInTheDocument();

    // Avg Check-in Time: (120 + 180) / 2 = 150s = "2m 30s", over 2 samples.
    const avg = screen.getByText('Avg Check-in Time').closest('div')!;
    expect(within(avg).getByText('2m 30s')).toBeInTheDocument();
    expect(within(avg).getByText('Across 2 check-ins')).toBeInTheDocument();

    // Pre-registered / Walk-in today: v1, v3 pre-approved; v2 walk-in.
    const split = screen.getByText('Pre-registered').closest('div')!;
    expect(within(split).getByText('2 / 1')).toBeInTheDocument();

    // Overstays: only v5 (checked in yesterday 16:00Z, deadline 12h later, now is past it).
    const overstays = screen.getByText('Overstays').closest('div')!;
    expect(within(overstays).getByText('1')).toBeInTheDocument();
    expect(within(overstays).getByText('Requires attention')).toBeInTheDocument();

    // Guest Satisfaction: (4 + 5) / 2 = 4.5, 2 reviews.
    const sat = screen.getByText('Guest Satisfaction').closest('div')!;
    expect(within(sat).getByText('4.5 ★')).toBeInTheDocument();
    expect(within(sat).getByText('Based on 2 reviews')).toBeInTheDocument();

    // Top Hosts: Asha Rao (2) ranked above Ben Iyer (1).
    const hostsPanel = screen.getByRole('region', { name: 'Top Hosts' });
    const hostNames = within(hostsPanel).getAllByText(/Asha Rao|Ben Iyer/).map((el) => el.textContent);
    expect(hostNames).toEqual(['Asha Rao', 'Ben Iyer']);

    // Lobby feed: most recent arrival first — Rahul (10:00), Priya (09:00), Meera (08:00).
    const feedPanel = screen.getByRole('region', { name: 'Live Lobby Feed' });
    const feedRows = within(feedPanel).getAllByRole('row').slice(1); // drop header row
    expect(feedRows[0]).toHaveTextContent('Rahul Sen');
    expect(feedRows[1]).toHaveTextContent('Priya Nair');
    expect(feedRows[2]).toHaveTextContent('Meera Iyer');
  });

  // THE READ-ONLY GUARANTEE (client instruction, 2026-08-17): the admin
  // visitor surface must never carry a write control anywhere.
  it('offers no button that writes to a visit, anywhere on the page', () => {
    mockVisits.current = {
      visits: [visitRow({ id: 'v1', checked_in_at: '2026-08-17T09:00:00Z' })],
      loading: false,
    };
    renderPage();
    for (const btn of screen.queryAllByRole('button')) {
      expect(btn.textContent).not.toMatch(/check in|check out|approve|reject|deny/i);
    }
  });
});
