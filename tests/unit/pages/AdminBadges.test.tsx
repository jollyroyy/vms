import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import AdminBadges from '../../../src/pages/Admin/AdminBadges';

// AdminBadges is a pure reader of migration 087's `badge_prints` log: three
// KPI tiles and a table, both fed by `useBadgePrints`. Mocking that hook,
// rather than the supabase query chain underneath it, keeps this suite
// focused on what the page composes — the same choice EntryExitTab.test.tsx
// makes for `useGateActivity`.
//
// The tab went from today-only to a ranged historical window (client
// instruction, 2026-08-17), the same change AdminVisitorsLog already took —
// the mock hook does not need to know the real date math, since the page
// derives the range and passes it straight to `useBadgePrints`; the mock
// just has to return prints regardless of what range it was called with.

afterEach(cleanup);

const mockPrints = vi.hoisted(() => ({ current: { prints: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useBadgePrints', () => ({
  useBadgePrints: (..._args: unknown[]) => mockPrints.current,
}));

// Supabase is not read directly by this page, but VisitorDetails and other
// deep imports touch the client module at import time; a chainable stub keeps
// the suite from hitting a real network call if anything does.
vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

function printRow(over: Record<string, any> = {}): any {
  return {
    id: 'bp1', visit_id: 'v1', printed_by: 'g1', badge_type: 'visitor',
    printed_at: '2026-08-17T05:00:00Z',
    visit: { visitor: { full_name: 'Rina Shah', vendor_name: 'Shah & Co' }, host: { full_name: 'K. Rao' } },
    printed_by_profile: { id: 'g1', full_name: 'Guard Naveen' },
    ...over,
  };
}

describe('AdminBadges', () => {
  afterEach(() => { mockPrints.current = { prints: [], loading: false }; });

  it('renders the Badge Printing heading', () => {
    render(<AdminBadges />);
    expect(screen.getByRole('heading', { name: 'Badge Printing' })).toBeInTheDocument();
    expect(screen.getByText('Badges the gate has issued.')).toBeInTheDocument();
  });

  it('shows an explanatory empty state, not an error, when nothing was printed', () => {
    render(<AdminBadges />);
    expect(screen.getAllByText(/No badge was printed in this window/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('marks the tab historical and renders the range bar above the tiles', () => {
    render(<AdminBadges />);
    expect(screen.getByText('Historical')).toBeInTheDocument();
    // AdminRangeBar's own preset control — "Last 30 Days" is AdminBadges's default.
    expect(screen.getByRole('button', { name: 'Last 30 Days' })).toBeInTheDocument();
    expect(screen.getByText(/Showing badge prints from/i)).toBeInTheDocument();
  });

  it('renders a print as a row, with the visitor, company, host, type, time and printer', () => {
    mockPrints.current = { prints: [printRow()], loading: false };
    render(<AdminBadges />);
    expect(screen.getByText('Rina Shah')).toBeInTheDocument();
    expect(screen.getByText('Shah & Co')).toBeInTheDocument();
    expect(screen.getByText('K. Rao')).toBeInTheDocument();
    const row = screen.getByText('Rina Shah').closest('tr') as HTMLElement;
    expect(within(row).getByText('Visitor')).toBeInTheDocument();
    expect(screen.getByText('Guard Naveen')).toBeInTheDocument();
  });

  it('reads "Not recorded" for a print with no printed_by, e.g. the kiosk', () => {
    mockPrints.current = {
      prints: [printRow({ printed_by: null, printed_by_profile: null })],
      loading: false,
    };
    render(<AdminBadges />);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('computes correct KPI counts from the fetched prints', () => {
    mockPrints.current = {
      prints: [
        printRow({ id: 'bp1', visit_id: 'v1', badge_type: 'visitor' }),
        printRow({ id: 'bp2', visit_id: 'v1', badge_type: 'reprint' }),
        printRow({ id: 'bp3', visit_id: 'v2', badge_type: 'visitor' }),
      ],
      loading: false,
    };
    render(<AdminBadges />);
    // Printed: 3 prints. Reprints: 1. Visitors Badged: 2 distinct visits.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('offers no control that writes a badge print — this tab reads the log only', () => {
    mockPrints.current = { prints: [printRow()], loading: false };
    render(<AdminBadges />);
    for (const label of [/check in/i, /check out/i, /^approve$/i, /^reject$/i, /print badge/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });
});
