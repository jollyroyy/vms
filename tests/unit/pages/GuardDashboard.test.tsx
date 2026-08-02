import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardDashboard from '../../../src/pages/Guard/Dashboard';

// GateStats shape mirrors src/lib/useGateStats.ts — kept local rather than
// imported so this file has no dependency on the hook's implementation.
// Defined inside vi.hoisted (not as a sibling const) because vi.hoisted
// bodies run before the rest of the module, including other top-level consts.
const EMPTY_STATS = {
  expected: 0, entered: 0, inside: 0, checkedOut: 0, declined: 0,
  awaitingApproval: 0, overdue: 0,
};

const mockStats = vi.hoisted(() => ({
  current: {
    stats: { expected: 0, entered: 0, inside: 0, checkedOut: 0, declined: 0, awaitingApproval: 0, overdue: 0 },
    loading: false,
  },
}));
const mockActivity = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));
const mockInside = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useGateStats', () => ({
  useGateStats: () => mockStats.current,
}));

vi.mock('../../../src/lib/useRecentActivity', () => ({
  useRecentActivity: () => mockActivity.current,
}));

vi.mock('../../../src/lib/useInsideNow', () => ({
  useInsideNow: () => mockInside.current,
}));

// Heavy children irrelevant to these tests — stubbed to keep this file
// focused on the composition Dashboard.tsx owns. GuardInsideNow keeps a
// minimal stand-in so the expand/collapse behaviour can still be observed.
vi.mock('../../../src/pages/Guard/GuardInsideNow', () => ({
  default: ({ visits }: { visits: any[] }) => (
    <div data-testid="inside-now-panel">
      {visits.map((v) => <span key={v.id}>{v.visitor?.full_name}</span>)}
    </div>
  ),
}));

vi.mock('../../../src/components/VisitorDetails', () => ({
  default: () => null,
}));

function renderDashboard() {
  return render(<MemoryRouter><GuardDashboard /></MemoryRouter>);
}

function tileFor(label: string): HTMLElement {
  return screen.getByText(label).closest('button, a') as HTMLElement;
}

describe('GuardDashboard', () => {
  afterEach(() => {
    cleanup();
    mockStats.current = { stats: { ...EMPTY_STATS }, loading: false };
    mockActivity.current = { visits: [], loading: false };
    mockInside.current = { visits: [], loading: false };
  });

  it('renders the page heading', () => {
    renderDashboard();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Security Gate');
  });

  it('renders all five KPI tile labels', () => {
    renderDashboard();
    expect(screen.getByText('Expected')).toBeInTheDocument();
    expect(screen.getByText('Inside Now')).toBeInTheDocument();
    expect(screen.getByText('Entered Today')).toBeInTheDocument();
    expect(screen.getByText('Checked Out')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  it('shows zeros for every tile when there is no data (empty state)', () => {
    renderDashboard();
    expect(tileFor('Expected').textContent).toContain('0');
    expect(tileFor('Inside Now').textContent).toContain('0');
    expect(tileFor('Entered Today').textContent).toContain('0');
    expect(tileFor('Checked Out').textContent).toContain('0');
    expect(tileFor('Declined').textContent).toContain('0');
  });

  it('renders seeded stats on their matching tiles', () => {
    mockStats.current = {
      stats: { expected: 5, inside: 3, entered: 8, checkedOut: 5, declined: 2, awaitingApproval: 1, overdue: 0 },
      loading: false,
    };
    renderDashboard();
    expect(tileFor('Expected').textContent).toContain('5');
    expect(tileFor('Inside Now').textContent).toContain('3');
    expect(tileFor('Entered Today').textContent).toContain('8');
    expect(tileFor('Checked Out').textContent).toContain('5');
    expect(tileFor('Declined').textContent).toContain('2');
  });

  // Regression guard: Inside Now (live, status === 'checked_in') and Entered
  // Today (cumulative, checked_in_at !== null) must never collapse into the
  // same number. Here inside=4, checkedOut=5, entered=9 (4 + 5), so the two
  // tiles must show 4 and 9 respectively — not the same value.
  it('shows Inside Now and Entered Today as different, independently correct numbers', () => {
    mockStats.current = {
      stats: { expected: 0, inside: 4, entered: 9, checkedOut: 5, declined: 0, awaitingApproval: 0, overdue: 0 },
      loading: false,
    };
    renderDashboard();
    const insideTile = tileFor('Inside Now');
    const enteredTile = tileFor('Entered Today');
    expect(insideTile.textContent).toContain('4');
    expect(enteredTile.textContent).toContain('9');
    expect(insideTile.textContent).not.toBe(enteredTile.textContent);
  });

  it('renders Inside Now as a toggle button that expands and collapses the on-site roster', () => {
    mockInside.current = {
      visits: [{ id: 'v1', visitor: { full_name: 'Alice Johnson' } }],
      loading: false,
    };
    renderDashboard();
    const tile = tileFor('Inside Now');
    expect(tile.tagName).toBe('BUTTON');
    expect(screen.getByText('Inside Now').closest('a')).toBeNull();

    expect(screen.queryByTestId('inside-now-panel')).toBeNull();
    fireEvent.click(tile);
    expect(screen.getByTestId('inside-now-panel')).toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();

    fireEvent.click(tile);
    expect(screen.queryByTestId('inside-now-panel')).toBeNull();
  });

  // Regression guard: Search and Quick Actions were deliberately removed from
  // the dashboard — starting a task now lives only in the console at
  // /visitors. Guard the absence so they don't silently creep back.
  it('renders no search box and no Quick Actions block', () => {
    renderDashboard();
    expect(screen.queryByLabelText('Search visitors')).toBeNull();
    expect(screen.queryByText('Quick Actions')).toBeNull();
    expect(screen.queryByText('New Visitor')).toBeNull();
    expect(screen.queryByText('Scan QR')).toBeNull();
  });

  // Regression guard: the Queue block (awaiting approval / expected /
  // overdue) was removed — that information lives in the console, not here.
  it('renders no queue block', () => {
    renderDashboard();
    expect(screen.queryByText('Awaiting host approval')).toBeNull();
    expect(screen.queryByText('Expected to arrive')).toBeNull();
    expect(screen.queryByText('Overdue arrivals')).toBeNull();
  });

  it('shows the empty state for Recent Activity when there is no activity', () => {
    renderDashboard();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No gate activity yet today.')).toBeInTheDocument();
  });

  it('renders visitor names in Recent Activity when there is data', () => {
    mockActivity.current = {
      visits: [
        { id: 'a1', status: 'checked_out', checked_in_at: '2026-08-02T09:00:00Z', created_at: '2026-08-02T08:00:00Z', visitor: { full_name: 'Priya Nair' } } as any,
        { id: 'a2', status: 'checked_in', checked_in_at: '2026-08-02T10:00:00Z', created_at: '2026-08-02T10:00:00Z', visitor: { full_name: 'Rahul Verma' } } as any,
      ],
      loading: false,
    };
    renderDashboard();
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    expect(screen.queryByText('No gate activity yet today.')).toBeNull();
  });
});
