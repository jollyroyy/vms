// The walk-in register (/guard/walk-in). Its left column is the walk-in's two
// waits, stacked in the order they happen — awaiting the HOST, then awaiting the
// GATE — and it carries no list of visitors who are already through the gate
// (client instruction, 2026-08-17). That last absence is the one worth pinning:
// an admitted visitor is the Entry & Exit tab's subject, and listing them here
// as well put one visitor on two surfaces with nothing saying which was
// authoritative.
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Visit } from '../../../src/types/index';

const visits = vi.hoisted(() => ({ rows: [] as Visit[] }));

vi.mock('../../../src/lib/useTodayVisits', () => ({
  useTodayVisits: () => ({ visits: visits.rows, loading: false }),
}));

vi.mock('../../../src/pages/Guard/WalkInRequest', () => ({
  default: () => <div data-testid="walk-in-form" />,
}));

vi.mock('../../../src/pages/Guard/PendingGateCheckIn', () => ({
  default: ({ waiting }: { waiting: Visit[] }) => (
    <div data-testid="gate-rows">{waiting.map((v) => <span key={v.id}>{v.visitor?.full_name}</span>)}</div>
  ),
}));

vi.mock('../../../src/pages/Guard/VisitorCard', () => ({
  default: ({ visit }: { visit: Visit }) => <div>{visit.visitor?.full_name}</div>,
}));

import RegisterWalkIn from '../../../src/pages/Guard/RegisterWalkIn';

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: 'v1',
  ref_number: 'VIS-20260817-0001',
  visitor_id: 'vis1',
  host_id: 'h1',
  department_id: 'd1',
  purpose: 'meeting',
  status: 'pending_approval',
  scheduled_for: null,
  checked_in_at: null,
  checked_out_at: null,
  created_at: new Date().toISOString(),
  visitor: { id: 'vis1', full_name: 'Ravi Kumar', phone: '9876543210' },
  ...over,
} as unknown as Visit);

const cleared = (over: Partial<Visit> = {}): Visit => visit({
  id: 'v2',
  status: 'walkin_approved',
  visitor: { id: 'vis2', full_name: 'Meena Iyer', phone: '9876500000' },
  ...over,
} as Partial<Visit>);

describe('RegisterWalkIn', () => {
  beforeEach(() => { visits.rows = []; });
  afterEach(() => cleanup());

  it('names the first wait "Awaiting host approval"', () => {
    render(<RegisterWalkIn />);
    expect(screen.getByText('Awaiting host approval')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting approval')).not.toBeInTheDocument();
  });

  it('carries an "Awaiting gate check-in" box below it', () => {
    render(<RegisterWalkIn />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Awaiting host approval', 'Awaiting gate check-in']);
  });

  it('lists a host-cleared walk-in in the gate box, not the approval box', () => {
    visits.rows = [visit(), cleared()];
    render(<RegisterWalkIn />);
    expect(screen.getByTestId('gate-rows')).toHaveTextContent('Meena Iyer');
    expect(screen.getByTestId('gate-rows')).not.toHaveTextContent('Ravi Kumar');
  });

  it('never lists visitors who are already through the gate', () => {
    visits.rows = [cleared({ id: 'v3', status: 'checked_in', checked_in_at: new Date().toISOString() })];
    render(<RegisterWalkIn />);
    expect(screen.queryByText(/already checked in/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('gate-rows')).not.toBeInTheDocument();
    expect(screen.queryByText('Meena Iyer')).not.toBeInTheDocument();
  });

  it('states each empty box in its own words', () => {
    render(<RegisterWalkIn />);
    expect(screen.getByText('Nothing waiting on a person to meet.')).toBeInTheDocument();
    expect(screen.getByText('Nobody is waiting to be checked in.')).toBeInTheDocument();
  });
});
