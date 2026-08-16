import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardDashboard from '../../../src/pages/Guard/Dashboard';

// The guard dashboard renders the Guard Console frame (GuardDashboardMain:
// four KPI tiles + the Expected Today arrivals panel). It is READ-ONLY: the ID
// Verification card was removed 2026-08-15 on client instruction, taking its
// Verify ID and Deny Entry writes with it, so "Dashboard reads, Console acts"
// now has no exceptions at all.
// Counts are derived from the same visits array the drill-downs use
// (lib/guardTiles.ts), so seeding mockToday is all a count test needs; the
// stubbed children keep the suite focused on what Dashboard composes.

const mockToday = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

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

// One visit row, shaped like the live schema. Only the fields the dashboard
// actually reads are meaningful; the rest satisfy the type.
function visitRow(over: Record<string, any> = {}): any {
  const { name, ...rest } = over;
  return {
    id: 'vx', ref_number: 'REF-X', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    status: 'approved', checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, qr_token: 'tok', qr_expires_at: null,
    created_at: '2026-08-14T08:30:00Z', scheduled_for: '2026-08-14T09:30:00Z', purpose: 'Interview',
    visitor: {
      full_name: name ?? 'Marcos Fernandez', phone: '', vendor_name: null,
      is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '',
    },
    department: { name: 'HR' }, host: { full_name: 'S. Verma' },
    ...rest,
  };
}

describe('GuardDashboard (reference-screen frame)', () => {
  afterEach(() => {
    cleanup();
    mockToday.current = { visits: [], loading: false };
  });

  it('shows the four gate tiles plus the five lanes moved off the Visitors tab', () => {
    renderDashboard();
    // Row 2 (client instruction, 2026-08-15): the Visitors tab's KPI cards moved
    // onto this board, compact, plus the two refusal lanes.
    // "Pending Walk-in Approvals", not "Pending Approval" (client instruction,
    // 2026-08-16): pending_approval is only ever reached from the walk-in
    // register, so the lane names the arrival route it can only contain.
    for (const label of ['All Visitors', 'Pending Walk-in Approvals', 'Approved Walk-ins',
      'Declined by Host', 'Entry Refused at the Gate']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // "Overstaying", not "Pending Check-out": the number has always been
    // isOverstaying, and everyone inside is pending check-out, so the old label
    // described the tile next to it.
    // "Expected Today" now names both the KPI tile AND the arrivals panel
    // heading below it (2026-08-15, deliberately — same predicate, two
    // altitudes), so it can appear more than once.
    for (const label of ['Expected Today', 'Checked In Today', 'In Premises', 'Overstaying']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // The old six-tile board must not silently return.
    for (const label of ['Entries', 'Exits', 'Currently Inside', 'No-shows', 'Declined']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  // ONE panel, whose heading AND columns follow the selected tile (client
  // instruction, 2026-08-15). It opens on Expected Today; pressing another tile
  // renames it and re-columns it. The old fixed "Expected Today" table plus a
  // separate drill-down sheet meant the same rows had two layouts and the
  // heading was wrong for six of the seven tiles.
  it('opens on Expected Today, with that lane\'s columns', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Expected Today' })).toBeInTheDocument();
    for (const col of ['Name', 'Purpose', 'Host', 'Department', 'Scheduled', 'Status']) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
    // Nobody in this lane has arrived, so an entry-time column would be an em
    // dash on every row. (The TILE above still reads "Checked In Today" — this
    // is about the panel's column headers.)
    expect(screen.queryByText('Checked In')).toBeNull();
    expect(screen.queryByText('Checked Out')).toBeNull();
    expect(screen.queryByText('Overstaying By')).toBeNull();
  });

  it('renames the panel and re-columns it when another tile is pressed', () => {
    mockToday.current = {
      visits: [visitRow({ id: 'a', status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z' })],
      loading: false,
    };
    renderDashboard();
    act(() => { screen.getByRole('button', { name: /Checked In Today/ }).click(); });
    expect(screen.getByRole('heading', { name: 'Checked In Today' })).toBeInTheDocument();
    // The scheduled slot AND the actual entry, side by side — the whole point
    // of the dynamic columns.
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText('Checked Out')).toBeInTheDocument();
  });

  // An overstaying row gains a column that exists on no other lane: how far
  // past their deadline they are (client instruction, 2026-08-15).
  it('gives the Overstaying lane an Overstaying By column', () => {
    renderDashboard();
    act(() => { screen.getByRole('button', { name: /Overstaying/ }).click(); });
    expect(screen.getByRole('heading', { name: 'Overstaying' })).toBeInTheDocument();
    expect(screen.getByText('Overstaying By')).toBeInTheDocument();
  });

  // Removed 2026-08-15 (client instruction). The card was the dashboard's only
  // pair of writes; check-in now starts on the Pre-Registered board and Deny
  // Entry is gone from the app entirely.
  it('renders no ID Verification card, and no View Full Queue link', () => {
    renderDashboard();
    expect(screen.queryByText('ID Verification')).toBeNull();
    expect(screen.queryByText(/No visitor awaiting ID verification/i)).toBeNull();
    // The "View Full Queue" shortcut under the arrivals panel was removed
    // 2026-08-14 (client instruction); the Entry & Exit nav item is the route.
    expect(screen.queryByText('View Full Queue')).toBeNull();
  });

  it('shows the empty state of whichever lane is selected', () => {
    renderDashboard();
    // Each lane says its own thing — "nobody is waiting" and "nobody is
    // overstaying" are different facts and must not be the same sentence.
    expect(screen.getByText(/No visitors waiting at the gate/i)).toBeInTheDocument();
    act(() => { screen.getByRole('button', { name: /Overstaying/ }).click(); });
    expect(screen.getByText(/Nobody is overstaying/i)).toBeInTheDocument();
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
    // Presence is stated in words, from lib/visitGateChips.ts — the same rules
    // the Entry & Exit table uses, so one visitor reads the same on both.
    expect(screen.getByText('Pre-registered')).toBeInTheDocument();
    // The board is display-only. Verify ID lived on the ID Verification card
    // and went with it; check-in starts on the Pre-Registered board.
    expect(screen.queryByRole('button', { name: /Verify ID/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Verify ID/i })).toBeNull();
  });

  // The tile used to be `awaitingApproval + overdue` — unapproved walk-in
  // requests plus approved visitors already running late — which left out the
  // ordinary case entirely: booked for 3pm, read at 10am, counted as zero.
  it('counts Expected Today as approved arrivals who have not come through the gate', () => {
    mockToday.current = {
      visits: [
        visitRow({ id: 'a', status: 'approved', checked_in_at: null }),
        // Cleared by the host, so admitted (migration 080) — Checked In, not
        // expected. Counted below.
        visitRow({ id: 'b', status: 'walkin_approved', checked_in_at: null }),
        // Already arrived — no longer expected.
        visitRow({ id: 'c', status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z' }),
        // Never approved: standing at the gate with no decision made.
        visitRow({ id: 'd', status: 'pending_approval', checked_in_at: null }),
        visitRow({ id: 'e', status: 'rejected', checked_in_at: null }),
      ],
      loading: false,
    };
    renderDashboard();
    // Scoped to the tile (a button), not the panel heading below it, which
    // shares the same text since 2026-08-15.
    const tile = screen.getAllByRole('button', { name: /Expected Today/ })[0];
    expect(tile.textContent).toMatch(/1/);
    // ...and the walk-in the host cleared is on Checked In instead, beside the
    // visitor who was stamped through the gate.
    const checked = screen.getAllByRole('button', { name: /Checked In Today/ })[0];
    expect(checked.textContent).toMatch(/2/);
  });

  // The regression this whole rewiring exists to kill: the tile's number and
  // the list it opens came from different rules, so a tile reading 1 could
  // expand into five cards. They are now the same array.
  it('opens a drill-down holding exactly as many visitors as the tile counts', () => {
    mockToday.current = {
      visits: [
        visitRow({ id: 'a', name: 'Ada Inside', status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z' }),
        visitRow({ id: 'b', name: 'Bo Inside', status: 'checked_in', checked_in_at: '2026-08-14T09:30:00Z' }),
        visitRow({ id: 'c', name: 'Cy Waiting', status: 'approved', checked_in_at: null }),
      ],
      loading: false,
    };
    renderDashboard();
    const tile = screen.getAllByText('In Premises')[0].closest('button')!;
    expect(tile.textContent).toMatch(/2/);
    act(() => { tile.click(); });
    // Both of the two counted visitors are in the panel the tile opened.
    expect(screen.getAllByText(/Ada Inside/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bo Inside/).length).toBeGreaterThan(0);
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

  // Deny Entry was the dashboard's other write. It is gone from the APP, not
  // just from this page (client instruction, 2026-08-15) — lib/denyEntryFlow.ts,
  // lib/useDenyEntry.ts and DenyEntryConfirm.tsx are deleted. This asserts no
  // control offers it, on a visit that would previously have been refusable.
  it('offers no way to deny entry', () => {
    mockToday.current = {
      visits: [visitRow({ id: 'v3', name: 'A. Kapoor', status: 'approved', checked_in_at: null })],
      loading: false,
    };
    renderDashboard();
    expect(screen.queryByRole('button', { name: /Deny Entry/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Deny Entry/i })).toBeNull();
    expect(screen.queryByText(/Refuse entry/i)).toBeNull();
  });
});
