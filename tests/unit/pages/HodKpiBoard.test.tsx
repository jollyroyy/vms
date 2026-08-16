// Client instruction, 2026-08-16: the HOD's landing page is the DASHBOARD, and
// every KPI on it drills down. The four stats used to be counted from a
// `select id, status` — the number was all there could ever be, so an HOD
// reading "3 awaiting decision" had no way to see the three.
//
// The rule under test is the guard board's: A TILE'S COUNT IS THE LENGTH OF THE
// LIST IT OPENS. Both come from lib/hodTiles.ts, so they cannot disagree.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import HodKpiBoard from '../../../src/pages/HOD/HodKpiBoard';
import { hodTileVisits, HOD_TILE_KEYS } from '../../../src/lib/hodTiles';
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
const scheduled = [visit({ id: 's-1', scheduled_for: '2026-08-16T10:00:00Z' })];
const day = [
  visit({ id: 'a-1', status: 'approved' }),
  visit({ id: 'a-2', status: 'walkin_approved' }),
  visit({ id: 'r-1', status: 'rejected' }),
];

const tiles = hodTileVisits({ day, onSite, walkIns, scheduled });

function renderBoard(selected: Parameters<typeof HodKpiBoard>[0]['selected'] = null) {
  const onSelect = vi.fn();
  render(<HodKpiBoard tiles={tiles} selected={selected} onSelect={onSelect} loading={false} />);
  return onSelect;
}

afterEach(cleanup);

describe('HOD dashboard KPI board', () => {
  it('renders every tile with the length of the list it opens', () => {
    renderBoard();
    expect(screen.getByText('On-site now').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Approvals today').parentElement).toHaveTextContent('2');
    // Pending is both pending lists — the two decision desks act on exactly
    // these rows, so the dashboard and the desks cannot disagree.
    expect(screen.getByText('Awaiting decision').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Walk-ins live').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Declined today').parentElement).toHaveTextContent('1');
  });

  it('every tile is a button, so no KPI is a dead number', () => {
    renderBoard();
    expect(screen.getAllByRole('button').length).toBe(HOD_TILE_KEYS.length);
  });

  it('opens the pressed tile’s rows, and the row count matches the tile', () => {
    renderBoard('walkins');
    const panel = document.getElementById('hod-kpi-drill')!;
    expect(panel).toBeInTheDocument();
    expect(panel.querySelectorAll('.hod-pulse-row').length).toBe(tiles.walkins.length);
    expect(panel).toHaveTextContent('Rahul Verma');
  });

  it('pressing the open tile again collapses it', () => {
    const onSelect = renderBoard('walkins');
    fireEvent.click(screen.getByText('Walk-ins live').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows the tile’s own empty line rather than a shared one', () => {
    render(
      <HodKpiBoard
        tiles={hodTileVisits({ day: [], onSite: [], walkIns: [], scheduled: [] })}
        selected="inside"
        onSelect={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByText('No visitor from this department is on site.')).toBeInTheDocument();
  });

  it('renders no panel at all until a tile is pressed', () => {
    renderBoard();
    expect(document.getElementById('hod-kpi-drill')).toBeNull();
  });

  // The board reads; the decision desks act. A dashboard that could clear a
  // visitor would be a second route to the same write.
  it('carries no approve or decline control', () => {
    renderBoard('pending');
    // The only control inside the panel is the one that closes it.
    const panel = document.getElementById('hod-kpi-drill')!;
    const controls = [...panel.querySelectorAll('button')];
    expect(controls.length).toBe(1);
    expect(controls[0]!.textContent).toMatch(/close/i);
  });
});
