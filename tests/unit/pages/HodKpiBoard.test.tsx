// Client instruction, 2026-08-16: the HOD's landing page is the DASHBOARD,
// every KPI on it drills down, and the whole surface must look and read exactly
// like the guard's — so this board renders the SAME components the guard
// dashboard does (components/DashboardTile, components/DashboardVisitorTable),
// not a lookalike of them.
//
// The rule under test is the guard board's: A TILE'S COUNT IS THE LENGTH OF THE
// LIST IT OPENS. Both come from lib/hodTiles.ts, so they cannot disagree.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import HodKpiBoard from '../../../src/pages/HOD/HodKpiBoard';
import { hodTileVisits, HOD_TILE_KEYS, HOD_PANEL_SPEC } from '../../../src/lib/hodTiles';
import type { Visit } from '../../../src/types/index';

const visit = (over: Partial<Visit> & { id: string }): Visit => ({
  id: over.id,
  visitor_id: 'v', department_id: 'd', host_id: 'h',
  purpose: 'meeting', status: 'pending_approval',
  created_at: '2026-08-16T04:00:00Z', scheduled_for: null,
  checked_in_at: null, checked_out_at: null,
  visitor: { full_name: 'Rahul Verma', vendor_name: 'Acme Supplies' },
  host: { full_name: 'Priya Sharma' },
  ...over,
} as unknown as Visit);

const onSite = [
  // Scheduled — a pre-approval who arrived. Its neighbour below has no slot,
  // so the On Site lane holds one of each origin.
  visit({ id: 'in-1', status: 'checked_in', scheduled_for: '2026-08-16T05:00:00Z' }),
  visit({ id: 'in-2', status: 'checked_in', visitor: { full_name: 'Sunil Das', vendor_name: 'Acme' } }),
];
const walkIns = [visit({ id: 'w-1' }), visit({ id: 'w-2' })];
const day = [
  visit({ id: 'a-1', status: 'approved', scheduled_for: '2026-08-16T09:00:00Z' }),
  visit({ id: 'a-2', status: 'walkin_approved' }),
  visit({ id: 'a-3', status: 'walkin_approved' }),
  visit({ id: 'r-1', status: 'rejected' }),
  // Arrived today and still here — one arrival, no departure.
  visit({
    id: 'c-1', status: 'checked_in',
    scheduled_for: '2026-08-16T04:30:00Z', checked_in_at: '2026-08-16T05:00:00Z',
  }),
  // Arrived today and gone home — one arrival AND one departure, which is
  // exactly why the two tiles cannot be derived from each other.
  visit({
    id: 'c-2', status: 'checked_out', scheduled_for: '2026-08-16T05:00:00Z',
    checked_in_at: '2026-08-16T05:30:00Z', checked_out_at: '2026-08-16T05:45:00Z',
  }),
  // Arrived at 21:00 IST YESTERDAY, left at 09:00 IST today. It is today's
  // departure and it is NOT today's arrival — the row the widened query was
  // added for, and the one that tells the two predicates apart.
  visit({
    id: 'c-3', status: 'checked_out',
    created_at: '2026-08-15T15:30:00Z', scheduled_for: '2026-08-15T15:00:00Z',
    checked_in_at: '2026-08-15T15:30:00Z', checked_out_at: '2026-08-16T03:30:00Z',
  }),
];

const NOW = new Date('2026-08-16T06:00:00Z');
const tiles = hodTileVisits({ day, onSite, walkIns }, NOW);
const initialsOf = (name: string | null | undefined) => (name ?? 'U').slice(0, 2).toUpperCase();

function renderBoard(selected: Parameters<typeof HodKpiBoard>[0]['selected'] = 'pending') {
  const onSelect = vi.fn();
  render(
    <HodKpiBoard
      tiles={tiles} dayVisits={day} selected={selected} onSelect={onSelect} loading={false}
      now={NOW} initialsOf={initialsOf} onOpen={vi.fn()}
    />,
  );
  return onSelect;
}

const tileButton = (label: string) => screen.getByText(label).closest('button')!;

afterEach(cleanup);

describe('HOD dashboard KPI board', () => {
  it('renders every tile with the length of the list it opens', () => {
    renderBoard();
    expect(tileButton('On Site Now')).toHaveTextContent('2');
    expect(tileButton('Declined')).toHaveTextContent('1');
    // "Awaiting Walk-in Approval" is both the tile label and the open panel's
    // heading, so it appears twice — take the tile.
    expect(screen.getAllByText('Awaiting Walk-in Approval')[0]!.closest('button')!).toHaveTextContent('2');
  });

  // Client instruction, 2026-08-16: the two clearances are two cards. A
  // pre-approval is a pass this HOD raised in advance; a walk-in approval is a
  // decision they made on a request the gate pushed at them. One tile could
  // only ever give one answer to both questions, and neither list could be
  // opened on its own.
  it('counts pre-approvals given and walk-ins approved as two separate tiles', () => {
    renderBoard();
    // a-1 plus the three arrival fixtures, which all carry a slot: a clearance
    // is not undone by the visitor turning up, so this lane keeps them.
    expect(tileButton('Pre-Approvals Given')).toHaveTextContent('4');
    expect(tileButton('Walk-ins Approved')).toHaveTextContent('2');
    expect(screen.queryByText('Approved Today')).toBeNull();
  });

  // Every row in those two lanes has one origin by definition, so a Type column
  // there would print the same word on every line — the tile's label said it.
  it.each(['preApprovedToday', 'walkInApprovedToday', 'pending'] as const)(
    'the %s lane carries no Type column, its label already says what it holds',
    (key) => {
      expect(HOD_PANEL_SPEC[key].columns.some((c) => c.key === 'origin')).toBe(false);
    },
  );

  // The lanes that MIX the two origins must say which is which, on every row
  // (client instruction: "always everybody should be able to see who is walk-in
  // and who is pre-approved").
  it('names each visitor’s origin on the lanes that mix them', () => {
    renderBoard('inside');
    const panel = document.getElementById('hod-kpi-drill')!;
    expect(within(panel).getByRole('columnheader', { name: 'Type of Visitor' })).toBeInTheDocument();
    expect(within(panel).getByText('Pre-approved')).toBeInTheDocument();
    expect(within(panel).getByText('Walk-in')).toBeInTheDocument();
  });

  it('every tile is a button, so no KPI is a dead number', () => {
    renderBoard();
    expect(screen.getAllByRole('button').length).toBe(HOD_TILE_KEYS.length);
  });

  // The tile's label IS the panel's heading — one string in HOD_PANEL_SPEC, so
  // a tile and the list it opens cannot be named two different things.
  it('the open panel is headed with the pressed tile’s own label', () => {
    renderBoard('inside');
    const panel = document.getElementById('hod-kpi-drill')!;
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent(HOD_PANEL_SPEC.inside.heading);
  });

  it('opens the pressed tile’s rows, and the row count matches the tile', () => {
    renderBoard('pending');
    const panel = document.getElementById('hod-kpi-drill')!;
    // One <tr> per row, plus the header row.
    expect(panel.querySelectorAll('tbody tr').length).toBe(tiles.pending.length);
    expect(panel).toHaveTextContent('Rahul Verma');
  });

  it('pressing a tile asks for that tile', () => {
    const onSelect = renderBoard('pending');
    fireEvent.click(tileButton('On Site Now'));
    expect(onSelect).toHaveBeenCalledWith('inside');
  });

  it('shows the tile’s own empty line rather than a shared one', () => {
    render(
      <HodKpiBoard
        tiles={hodTileVisits({ day: [], onSite: [], walkIns: [] }, NOW)}
        dayVisits={[]} selected="inside" onSelect={vi.fn()} loading={false}
        now={NOW} initialsOf={initialsOf} onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText(HOD_PANEL_SPEC.inside.empty)).toBeInTheDocument();
  });

  // The board reads; the walk-in desk acts. A dashboard that could clear a
  // visitor would be a second route to the same write.
  it('carries no approve or decline control', () => {
    renderBoard('pending');
    const panel = document.getElementById('hod-kpi-drill')!;
    expect(panel.querySelectorAll('button').length).toBe(0);
  });

  // ── Check-ins and check-outs (client instruction, 2026-08-17) ────────────
  //
  // The board could say how many passes an HOD had issued and how many of their
  // visitors were on site, and left "how many turned up" and "how many have
  // gone home" to be worked out as the difference — which does not work, since
  // On Site Now is LIVE and can hold somebody who arrived yesterday.
  describe('check-in and check-out tiles', () => {
    it('counts arrivals and departures as two tiles, each the length of its own list', () => {
      renderBoard();
      // c-1 and c-2 arrived today. c-3 arrived YESTERDAY, so it is not here.
      expect(tileButton('Checked In')).toHaveTextContent('2');
      // c-2 and c-3 both LEFT today, whichever day they arrived.
      expect(tileButton('Checked Out')).toHaveTextContent('2');
    });

    // The distinction the whole widening exists for: a visitor who arrived at
    // 21:00 yesterday and left at 09:00 today is today's departure and is not
    // today's arrival. `status === 'checked_out'` cannot tell that row apart
    // from one that arrived and left yesterday, which is why neither tile is
    // keyed on the status.
    it('files the midnight-crossing visit as a departure and not as an arrival', () => {
      expect(tiles.checkedOut.map((v) => v.id)).toContain('c-3');
      expect(tiles.checkedIn.map((v) => v.id)).not.toContain('c-3');
    });

    it('opens the arrivals it counted, with an exit column that says who is still here', () => {
      renderBoard('checkedIn');
      const panel = document.getElementById('hod-kpi-drill')!;
      expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent('Checked In');
      expect(panel.querySelectorAll('tbody tr').length).toBe(tiles.checkedIn.length);
    });
  });

  // Client instruction, 2026-08-17: say the window once at the top, and take
  // "Today" off the individual cards. Both halves are asserted — a heading that
  // arrives while the tiles keep the word is just one more thing on screen.
  describe('the window is stated once, at the top', () => {
    it('heads the board with Today at a Glance', () => {
      renderBoard();
      expect(screen.getByRole('heading', { name: /Today at a Glance/ })).toBeInTheDocument();
    });

    // An h2, never an h1: the sidebar item just clicked already names the page,
    // the same call the guard dashboard made in 2026-08-13.
    it('is not a page heading', () => {
      renderBoard();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    });

    it('leaves the word Today on no tile label', () => {
      renderBoard();
      for (const key of HOD_TILE_KEYS) {
        expect(HOD_PANEL_SPEC[key].heading).not.toMatch(/today/i);
      }
    });
  });

  // The HOD board must not grow a stylesheet of its own again — styles/
  // hod-compact.css was an 8-to-11px type scale in a private accent hue, which
  // is what made this surface read as a different application from the guard's.
  it('renders no hod-* class of its own', () => {
    const { container } = render(
      <HodKpiBoard
        tiles={tiles} dayVisits={day} selected="pending" onSelect={vi.fn()} loading={false}
        now={NOW} initialsOf={initialsOf} onOpen={vi.fn()}
      />,
    );
    expect(container.querySelector('[class*="hod-stat"], [class*="hod-card"], [class*="hod-pulse"]')).toBeNull();
  });
});
