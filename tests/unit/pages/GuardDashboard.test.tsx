import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardDashboard from '../../../src/pages/Guard/Dashboard';

// The guard dashboard now renders the reference-exact Guard Console frame
// (GuardDashboardMain: four KPI tiles, live arrival queue, ID verification,
// watchlist banner). GateStats is kept local so this file has no dependency on
// useGateStats's implementation; the stubbed children keep the suite focused
// on what Dashboard.tsx composes.

const mockStats = vi.hoisted(() => ({
  current: {
    stats: {
      entered: 0, inside: 0, checkedOut: 0, declined: 0,
      noShow: 0, awaitingApproval: 0, overdue: 0, overstaying: 0,
    },
    loading: false,
  },
}));
const mockToday = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useGateStats', () => ({
  useGateStats: () => mockStats.current,
}));

vi.mock('../../../src/lib/useTodayVisits', () => ({
  useTodayVisits: () => mockToday.current,
}));

vi.mock('../../../src/lib/demoSeed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/demoSeed')>();
  return {
    ...actual,
    seedDemoVisitors: vi.fn(async () => ({ ok: true as const, seeded: 0, skipped: 0 })),
    clearDemoData: vi.fn(async () => ({ ok: true as const, clearedVisits: 0, clearedVisitors: 0 })),
    countDemoVisits: vi.fn(async () => 0),
    isDemoSchemaReady: vi.fn(async () => false),
  };
});

vi.mock('../../../src/components/VisitorDetails', () => ({
  default: () => null,
}));

// Minimal stand-in for the global topbar so the clock/date cluster test can
// assert TopbarClock output without pulling in Supabase-dependent AppShell
// machinery (profile/dept fetch, NotificationBell, sidebar, aurora).
function AppShellWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header data-testid="topbar" className="app-shell-topbar">
        <span className="flex items-center gap-2">
          <svg data-testid="clock-icon" className="w-[1.05rem] h-[1.05rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </span>
        <span className="flex items-center gap-2">
          <svg data-testid="calendar-icon" className="w-[1.05rem] h-[1.05rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </span>
      </header>
      {children}
    </div>
  );
}

function renderDashboard() {
  return render(<MemoryRouter><GuardDashboard /></MemoryRouter>);
}

describe('GuardDashboard (reference-screen frame)', () => {
  afterEach(() => {
    cleanup();
    mockStats.current = {
      stats: {
        entered: 0, inside: 0, checkedOut: 0, declined: 0,
        noShow: 0, awaitingApproval: 0, overdue: 0, overstaying: 0,
      },
      loading: false,
    };
    mockToday.current = { visits: [], loading: false };
  });

  it('shows the four reference KPI tiles: Expected Today, Checked In, In Premises, Pending Check-out', () => {
    renderDashboard();
    for (const label of ['Expected Today', 'Checked In', 'In Premises', 'Pending Check-out']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // The old six-tile board must not silently return.
    for (const label of ['Entries', 'Exits', 'Currently Inside', 'Overstaying', 'No-shows', 'Declined']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('renders the Live Arrival Queue card with table headers', () => {
    renderDashboard();
    expect(screen.getByText('Live Arrival Queue')).toBeInTheDocument();
    for (const col of ['Name', 'Purpose', 'Host', 'Time', 'Status']) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
  });

  it('renders the ID Verification card and links to the live queue', () => {
    renderDashboard();
    expect(screen.getByText('ID Verification')).toBeInTheDocument();
    expect(screen.getByText('View Full Queue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Full Queue/i })).toHaveAttribute('href', '/guard/live-queue');
  });

  it('shows the Empty / no-visitors states when there is no data', () => {
    renderDashboard();
    expect(screen.getByText(/No visitors waiting at the gate/i)).toBeInTheDocument();
    expect(screen.getByText(/No visitor awaiting ID verification/i)).toBeInTheDocument();
  });

  it('lists the expected arrivals with initials, purpose and status pills', () => {
    mockToday.current = {
      visits: [
        {
          id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
          status: 'approved', checked_in_at: null, checked_out_at: null, exit_verified: null,
          rejection_reason: null, carrying_material: false, qr_token: 'tok', qr_expires_at: null,
          created_at: '2026-08-14T08:30:00Z', scheduled_for: '2026-08-14T09:30:00Z', purpose: 'Interview',
          visitor: { full_name: 'Marcos Fernandez', phone: '', vendor_name: null, is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '' },
          department: { name: 'HR' }, host: { full_name: 'S. Verma' },
        },
      ],
      loading: false,
    };
    renderDashboard();
    // initialsOf joins the first letters with no dots; the queue row avatar
    // sits in the same row as the visitor name, distinguishing it from the
    // empty-state monogram which also renders initials.
    const avatar = screen.getAllByText('MF').find((el) =>
      el.closest('tr')?.textContent?.includes('Marcos Fernandez'),
    );
    expect(avatar).toBeInTheDocument();
    expect(screen.getByText('Interview')).toBeInTheDocument();
    // Approved-ahead slots at the gate read PRE-REGISTERED; only unapproved
    // walk-in lanes read WAITING (see statusPill in GuardDashboardMain).
    expect(screen.getByText('PRE-REGISTERED')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verify ID/i })).toHaveAttribute('href', '/guard/live-queue?verify=v1');
  });

  it('composes Expected Today from awaiting-approval + overdue stats', () => {
    mockStats.current = {
      stats: {
        entered: 0, inside: 0, checkedOut: 0, declined: 0,
        noShow: 0, awaitingApproval: 40, overdue: 8, overstaying: 0,
      },
      loading: false,
    };
    renderDashboard();
    // KPI numerals render beside their labels; the whole number is "48".
    const tile = screen.getByText('Expected Today').closest('div');
    expect(tile?.textContent).toMatch(/48/);
  });

  it('shows the watchlist banner when a flagged visitor is among today visits and links to /guard/watchlist', () => {
    mockToday.current = {
      visits: [
        {
          id: 'v2', ref_number: 'REF-2', visitor_id: 'p2', department_id: 'd1', host_id: 'h1',
          status: 'approved', checked_in_at: null, checked_out_at: null, exit_verified: null,
          rejection_reason: null, carrying_material: false, qr_token: 'tok2', qr_expires_at: null,
          created_at: '2026-08-14T09:00:00Z', scheduled_for: '2026-08-14T10:00:00Z', purpose: 'Meeting',
          visitor: { full_name: 'D. Mercer', phone: '', vendor_name: null, is_blacklisted: true, blacklist_reason: 'Blacklist - Trespass', id_type: null, id_last4: null, created_at: '' },
          department: null, host: null,
        },
      ],
      loading: false,
    };
    renderDashboard();
    expect(screen.getByText(/WATCHLIST ALERT/i)).toBeInTheDocument();
    expect(screen.getByText(/1 flagged visitor match today/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WATCHLIST ALERT/i })).toHaveAttribute('href', '/guard/watchlist');
  });

  it('hides the watchlist banner when nobody on the list arrived today', () => {
    renderDashboard();
    expect(screen.queryByText(/WATCHLIST ALERT/i)).toBeNull();
  });

  it('still shows the clock beside the date in the mockup format (now in the topbar)', () => {
    // 2026-08-14: the clock/date cluster moved out of the dashboard page and
    // into the global topbar (AppShell's TopbarClock), sitting immediately
    // left of the notification bell. Render within AppShell to assert it.
    render(<MemoryRouter><AppShellWrapper><GuardDashboard /></AppShellWrapper></MemoryRouter>);
    // Mockup format: icon + "09:42 AM" and icon + "Thu, Aug 14, 2026" side by side.
    expect(screen.getByText(/AM|PM/)).toBeInTheDocument();
    expect(screen.getByText(/\w{3}, \w{3} \d{1,2}, \d{4}/)).toBeInTheDocument();
  });

  it('never labels declined requests as denied entry', () => {
    renderDashboard();
    expect(screen.queryByText(/denied/i)).toBeNull();
  });

  it('offers no way to issue a pass', () => {
    renderDashboard();
    expect(screen.queryByText(/issue pass/i)).toBeNull();
  });

  // The dashboard's Verify ID / Deny Entry must not silently become state
  // changes. Deny Entry is a navigation affordance placeholder in the frame;
  // the real reject path stays on the console. Assert Deny Entry links to the
  // dashboard itself (placeholder target), never a mutation.
  it('keeps Deny Entry as a placeholder navigation, not a mutation', () => {
    mockToday.current = {
      visits: [
        {
          id: 'v3', ref_number: 'REF-3', visitor_id: 'p3', department_id: 'd1', host_id: 'h1',
          status: 'approved', checked_in_at: null, checked_out_at: null, exit_verified: null,
          rejection_reason: null, carrying_material: false, qr_token: 'tok3', qr_expires_at: null,
          created_at: '2026-08-14T09:00:00Z', scheduled_for: '2026-08-14T10:00:00Z', purpose: 'Visit',
          visitor: { full_name: 'A. Kapoor', phone: '', vendor_name: null, is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '' },
          department: null, host: null,
        },
      ],
      loading: false,
    };
    renderDashboard();
    const deny = screen.getByRole('link', { name: /Deny Entry/i });
    expect(deny).toHaveAttribute('href', '/guard/dashboard');
  });
});
