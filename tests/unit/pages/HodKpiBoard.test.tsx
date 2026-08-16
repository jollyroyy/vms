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

const onSite = [visit({ id: 'in-1', status: 'checked_in' })];
const walkIns = [visit({ id: 'w-1' }), visit({ id: 'w-2' })];
const day = [
  visit({ id: 'a-1', status: 'approved' }),
  visit({ id: 'a-2', status: 'walkin_approved' }),
  visit({ id: 'r-1', status: 'rejected' }),
];

const tiles = hodTileVisits({ day, onSite, walkIns });
const NOW = new Date('2026-08-16T06:00:00Z');
const initialsOf = (name: string | null | undefined) => (name ?? 'U').slice(0, 2).toUpperCase();

function renderBoard(selected: Parameters<typeof HodKpiBoard>[0]['selected'] = 'pending') {
  const onSelect = vi.fn();
  render(
    <HodKpiBoard
      tiles={tiles} selected={selected} onSelect={onSelect} loading={false}
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
    expect(tileButton('On Site Now')).toHaveTextContent('1');
    expect(tileButton('Approved Today')).toHaveTextContent('2');
    expect(tileButton('Declined Today')).toHaveTextContent('1');
    // "Awaiting Your Decision" is both the tile label and the open panel's
    // heading, so it appears twice — take the tile.
    expect(screen.getAllByText('Awaiting Your Decision')[0]!.closest('button')!).toHaveTextContent('2');
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
        tiles={hodTileVisits({ day: [], onSite: [], walkIns: [] })}
        selected="inside" onSelect={vi.fn()} loading={false}
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

  // The HOD board must not grow a stylesheet of its own again — styles/
  // hod-compact.css was an 8-to-11px type scale in a private accent hue, which
  // is what made this surface read as a different application from the guard's.
  it('renders no hod-* class of its own', () => {
    const { container } = render(
      <HodKpiBoard
        tiles={tiles} selected="pending" onSelect={vi.fn()} loading={false}
        now={NOW} initialsOf={initialsOf} onOpen={vi.fn()}
      />,
    );
    expect(container.querySelector('[class*="hod-stat"], [class*="hod-card"], [class*="hod-pulse"]')).toBeNull();
  });
});
