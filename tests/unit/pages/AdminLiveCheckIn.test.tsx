import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import AdminLiveCheckIn from '../../../src/pages/Admin/AdminLiveCheckIn';

// AdminLiveCheckIn is the admin's read-only mirror of the guard's Entry & Exit
// tab: one `useAdminVisits({ kind: 'today' })` fetch and four lanes (Expected /
// Inside / Checked Out / Awaiting Approval) over the same array. Mocking the hook
// directly — the pattern EntryExitTab.test.tsx uses for `useGateActivity` —
// keeps this suite about what the page composes, not about the supabase query
// chain.
//
// IT CARRIES NO KPI TILES SINCE 2026-08-17, and the test below pins that. The
// tab had four; two of them printed the same figures as the lane badges
// directly beneath, one printed the Dashboard tab's headline figure, and the
// fourth was a count with no list to open. Every count on this page is now a
// lane badge, which is the only arrangement in which a number and the rows it
// stands for cannot drift apart.

// THE CLOCK IS PINNED TO THE DAY THE FIXTURES DESCRIBE. The Checked Out lane
// keys on `checked_out_at >= istDayStart()` — the same window the guard's
// Entry & Exit tab uses — so a fixture stamped 2026-08-17 silently stopped
// being "today" the moment the real date rolled past it, and two tests here
// began failing on a change nobody made. A suite that asserts anything about an
// IST day has to say WHICH day it means.
beforeEach(() => {
  vi.useFakeTimers();
  // 2026-08-17 12:00 IST — mid-afternoon on the fixtures' own day, so nothing
  // sits near a boundary.
  vi.setSystemTime(new Date('2026-08-17T06:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

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

// TODAY'S PRE-APPROVAL THAT HAS NOT ARRIVED — the Expected lane, which is the
// whole of what the merged-away Pre-Registration tab had that nothing else
// said (client instruction, 2026-08-18). `isPreRegisteredArrival` is the
// guard's own predicate, so this row is on the gate's Pre-Registered board at
// the same moment.
function expectedVisit(over: Record<string, any> = {}): any {
  return {
    id: 'v-exp', ref_number: 'VIS-4', status: 'approved',
    checked_in_at: null, checked_out_at: null,
    created_at: '2026-08-16T05:00:00Z', scheduled_for: '2026-08-17T10:00:00Z',
    purpose: 'interview', qr_token: 't4',
    visitor: { full_name: 'Meera Shah', vendor_name: 'Shah & Co' },
    host: { full_name: 'K. Bose' }, department: { name: 'HR' },
    ...over,
  };
}

describe('AdminLiveCheckIn', () => {
  afterEach(() => { mockVisits.current = { visits: [], loading: false }; });

  it('renders the Live Check-In heading and says it is live, not historical', () => {
    render(<AdminLiveCheckIn />);
    expect(screen.getByRole('heading', { name: 'Live Check-In' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Historical')).toBeNull();
    // NO BLURB (client instruction, 2026-08-18) — the lanes name themselves.
    expect(screen.queryByText(/gate is handling right now/i)).toBeNull();
  });

  // PRE-REGISTRATION MERGED IN HERE (client instruction, 2026-08-18). A booked
  // visitor who has not walked in is a person the gate is waiting for, which is
  // what this roster is a roster of; the old tab's ranged history of every
  // booking ever made is the Reports register's job.
  it('lists today’s un-arrived pre-approvals on their own Expected lane', () => {
    mockVisits.current = { visits: [expectedVisit(), insideVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    // Not on the default (Inside) lane — that visitor has not arrived.
    expect(screen.queryByText('Meera Shah')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Expected/i }));
    expect(screen.getByText('Meera Shah')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Mehta')).toBeNull();
  });

  it('gives the Expected lane its own empty state', () => {
    render(<AdminLiveCheckIn />);
    fireEvent.click(screen.getByRole('tab', { name: /Expected/i }));
    expect(screen.getByText('Nobody is booked in for the rest of today.')).toBeInTheDocument();
  });

  // A visitor who has arrived is the Inside lane's subject and leaves this one
  // — the same one-visitor-on-one-surface rule the guard's board follows.
  it('drops a pre-approval from Expected the moment it is checked in', () => {
    mockVisits.current = {
      visits: [expectedVisit({ status: 'checked_in', checked_in_at: '2026-08-17T05:00:00Z' })],
      loading: false,
    };
    render(<AdminLiveCheckIn />);
    fireEvent.click(screen.getByRole('tab', { name: /Expected/i }));
    expect(screen.queryByText('Meera Shah')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /^Inside/i }));
    expect(screen.getByText('Meera Shah')).toBeInTheDocument();
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

  it('lists the walk-ins nobody has answered on their own lane', () => {
    mockVisits.current = { visits: [insideVisit(), pendingVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    expect(screen.queryByText('Nikhil Rao')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Awaiting Approval/i }));
    expect(screen.getByText('Nikhil Rao')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Mehta')).toBeNull();
  });

  it('gives the Awaiting Approval lane its own empty state', () => {
    render(<AdminLiveCheckIn />);
    fireEvent.click(screen.getByRole('tab', { name: /Awaiting Approval/i }));
    expect(screen.getByText('Every walk-in request has been answered.')).toBeInTheDocument();
  });

  // A waiting visitor has no arrival to print. An em dash under "Checked In"
  // on every row would state "not recorded" where the truth is "has not
  // happened yet", so the lane swaps both arrival stamps for the moment the
  // request was raised — the figure the delay is actually measured from.
  it('prints the request time, not empty arrival columns, on the pending lane', () => {
    mockVisits.current = { visits: [pendingVisit()], loading: false };
    render(<AdminLiveCheckIn />);
    fireEvent.click(screen.getByRole('tab', { name: /Awaiting Approval/i }));
    expect(screen.getByRole('columnheader', { name: /Requested/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Checked In/i })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Checked Out/i })).toBeNull();
  });

  // The de-duplication of 2026-08-17. Each of these labels was a KPI tile whose
  // figure was already on screen — twice over for the two that restated the
  // lane badges directly beneath them. Re-adding any of them is a regression,
  // not a feature.
  it('carries no KPI tiles restating the lane badges or the Dashboard tab', () => {
    mockVisits.current = {
      visits: [insideVisit(), departedVisit(), pendingVisit()],
      loading: false,
    };
    render(<AdminLiveCheckIn />);
    for (const label of ['Arrived Today', 'Currently Inside', 'Departed Today']) {
      expect(screen.queryByText(label)).toBeNull();
    }
    // "Awaiting Approval" survives as a TAB, never as a tile — a count with a
    // list behind it rather than a count on its own.
    expect(screen.getByRole('tab', { name: /Awaiting Approval/i })).toBeInTheDocument();
  });

  it('each lane shows its own count on its own tab, including the pending one', () => {
    mockVisits.current = {
      visits: [expectedVisit(), insideVisit(), departedVisit(), pendingVisit()],
      loading: false,
    };
    render(<AdminLiveCheckIn />);
    for (const name of [/Expected/i, /^Inside/i, /Checked Out/i, /Awaiting Approval/i]) {
      expect(within(screen.getByRole('tab', { name })).getByText('1')).toBeInTheDocument();
    }
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
