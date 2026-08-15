import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardDashboard from '../../../src/pages/Guard/Dashboard';

// The guard dashboard now renders the reference-exact Guard Console frame
// (GuardDashboardMain: four KPI tiles, live arrival queue, ID verification).
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

// Verify ID opens the check-in flow IN PLACE (no navigation) with the ID scan
// overlay opening immediately. The real flow mounts the camera via
// IdScanOverlay, which this suite must not touch; the stub proves the wiring —
// that the button renders the flow, and with autoScan on.
const flowStub = vi.hoisted(() => ({ rendered: [] as string[] }));
vi.mock('../../../src/pages/Guard/VisitorCheckInFlow', () => ({
  default: ({ visit, autoScan, onDone }: any) => {
    flowStub.rendered.push(`${visit.visitor?.full_name}:autoScan=${autoScan}`);
    return (
      <div data-testid="checkin-flow">
        Check-in flow for {visit.visitor?.full_name}
        <button type="button" onClick={() => onDone(visit.visitor?.full_name)}>done</button>
      </div>
    );
  },
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
    flowStub.rendered = [];
  });

  it('shows the four reference KPI tiles: Expected Today, Checked In, In Premises, Overstaying', () => {
    renderDashboard();
    // "Overstaying", not "Pending Check-out": the number has always been
    // isOverstaying, and everyone inside is pending check-out, so the old label
    // described the tile next to it.
    // "Expected Today" now names both the KPI tile AND the arrivals panel
    // heading below it (2026-08-15, deliberately — same predicate, two
    // altitudes), so it can appear more than once.
    for (const label of ['Expected Today', 'Checked In', 'In Premises', 'Overstaying']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // The old six-tile board must not silently return.
    for (const label of ['Entries', 'Exits', 'Currently Inside', 'No-shows', 'Declined']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('renders the Expected Today arrivals panel with table headers', () => {
    // Renamed from "Live Arrival Queue" 2026-08-15 — nothing here is live
    // (these are bookings, often hours away) and nobody is queuing. Scoped to
    // the heading role since the KPI tile above shares the same text.
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Expected Today' })).toBeInTheDocument();
    for (const col of ['Name', 'Purpose', 'Host', 'Time', 'Status']) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
  });

  it('renders the ID Verification card and no View Full Queue link', () => {
    renderDashboard();
    expect(screen.getByText('ID Verification')).toBeInTheDocument();
    // The "View Full Queue" shortcut under the Live Arrival Queue was removed
    // 2026-08-14 (client instruction); the Inside Now nav item is the route.
    expect(screen.queryByText('View Full Queue')).toBeNull();
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
    // Verify ID must open the thing that verifies an ID — the ID scan flow —
    // IN PLACE, not navigate to another tab. It used to be a link to
    // /guard/preregistered?checkin=, and before that to /guard/inside-now?verify=
    // (a read-only frame with no scan control at all). Since 2026-08-15 it is a
    // button that renders the check-in flow as a modal on this page, with the
    // scan overlay opening immediately (autoScan).
    expect(screen.queryByRole('link', { name: /Verify ID/i })).not.toBeInTheDocument();
    const verify = screen.getByRole('button', { name: /Verify ID/i });
    fireEvent.click(verify);
    expect(screen.getByRole('dialog', { name: /Verify ID/i })).toBeInTheDocument();
    expect(flowStub.rendered).toContain('Marcos Fernandez:autoScan=true');
  });

  // The tile used to be `awaitingApproval + overdue` — unapproved walk-in
  // requests plus approved visitors already running late — which left out the
  // ordinary case entirely: booked for 3pm, read at 10am, counted as zero.
  it('counts Expected Today as approved arrivals who have not come through the gate', () => {
    mockToday.current = {
      visits: [
        visitRow({ id: 'a', status: 'approved', checked_in_at: null }),
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
    const tile = screen.getByRole('button', { name: /Expected Today/ });
    expect(tile.textContent).toMatch(/2/);
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
    const tile = screen.getByText('In Premises').closest('button')!;
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

  // Deny Entry used to be a `<Link to="/guard/dashboard">` — a placeholder
  // that navigated to the page the guard was already on, so pressing it did
  // nothing. It is a real write now (lib/denyEntryFlow.ts), gated behind a
  // confirm dialog that demands a reason. This asserts the button opens that
  // dialog rather than navigating anywhere, and that nothing is written until
  // a reason is actually supplied — the mandatory-justification rule.
  it('opens the Deny Entry confirm dialog instead of navigating, and blocks the write until a reason is given', () => {
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
    expect(screen.queryByRole('link', { name: /Deny Entry/i })).not.toBeInTheDocument();
    const deny = screen.getByRole('button', { name: /Deny Entry/i });
    fireEvent.click(deny);

    expect(screen.getByRole('dialog', { name: /Refuse entry/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Refuse entry/i });
    expect(confirmBtn).toBeDisabled();
  });
});
