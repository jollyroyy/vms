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
  preApproved: 0, walkInApproved: 0, entered: 0, inside: 0, checkedOut: 0, declined: 0,
  noShow: 0, awaitingApproval: 0, overdue: 0,
};

const mockStats = vi.hoisted(() => ({
  current: {
    stats: {
      preApproved: 0, walkInApproved: 0, entered: 0, inside: 0, checkedOut: 0, declined: 0,
      noShow: 0, awaitingApproval: 0, overdue: 0,
    },
    loading: false,
  },
}));
const mockActivity = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));
const mockToday = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useGateStats', () => ({
  useGateStats: () => mockStats.current,
}));

vi.mock('../../../src/lib/useRecentActivity', () => ({
  useRecentActivity: () => mockActivity.current,
}));

vi.mock('../../../src/lib/useTodayVisits', () => ({
  useTodayVisits: () => mockToday.current,
}));

// Heavy children irrelevant to these tests — stubbed to keep this file focused
// on the composition Dashboard.tsx owns. The drill-down keeps a minimal
// stand-in that echoes which key it was opened with, so the expand/collapse
// behaviour and the tile→panel wiring can still be observed.
vi.mock('../../../src/pages/Guard/DashboardDrilldown', () => ({
  default: ({ drillKey, visits }: { drillKey: string; visits: any[] }) => (
    <div data-testid="drilldown-panel" data-key={drillKey}>
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
    mockToday.current = { visits: [], loading: false };
  });

  it('renders the page heading', () => {
    renderDashboard();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Security Gate');
  });

  it('renders all seven KPI tile labels', () => {
    renderDashboard();
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
    expect(screen.getByText('Walk-ins Approved')).toBeInTheDocument();
    expect(screen.getByText('Inside Now')).toBeInTheDocument();
    expect(screen.getByText('Entered Today')).toBeInTheDocument();
    expect(screen.getByText('Checked Out')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.getByText('No Show')).toBeInTheDocument();
  });

  it('shows zeros for every tile when there is no data (empty state)', () => {
    renderDashboard();
    expect(tileFor('Pre-approved').textContent).toContain('0');
    expect(tileFor('Walk-ins Approved').textContent).toContain('0');
    expect(tileFor('Inside Now').textContent).toContain('0');
    expect(tileFor('Entered Today').textContent).toContain('0');
    expect(tileFor('Checked Out').textContent).toContain('0');
    expect(tileFor('Declined').textContent).toContain('0');
    expect(tileFor('No Show').textContent).toContain('0');
  });

  it('renders seeded stats on their matching tiles', () => {
    mockStats.current = {
      stats: {
        preApproved: 5, walkInApproved: 4, inside: 3, entered: 8, checkedOut: 5, declined: 2,
        noShow: 6, awaitingApproval: 1, overdue: 0,
      },
      loading: false,
    };
    renderDashboard();
    expect(tileFor('Pre-approved').textContent).toContain('5');
    expect(tileFor('Walk-ins Approved').textContent).toContain('4');
    expect(tileFor('Inside Now').textContent).toContain('3');
    expect(tileFor('Entered Today').textContent).toContain('8');
    expect(tileFor('Checked Out').textContent).toContain('5');
    expect(tileFor('Declined').textContent).toContain('2');
    expect(tileFor('No Show').textContent).toContain('6');
  });

  // Regression guard: Inside Now (live, status === 'checked_in') and Entered
  // Today (cumulative, checked_in_at !== null) must never collapse into the
  // same number. Here inside=4, checkedOut=5, entered=9 (4 + 5), so the two
  // tiles must show 4 and 9 respectively — not the same value.
  it('shows Inside Now and Entered Today as different, independently correct numbers', () => {
    mockStats.current = {
      stats: {
        preApproved: 0, walkInApproved: 0, inside: 4, entered: 9, checkedOut: 5, declined: 0,
        noShow: 0, awaitingApproval: 0, overdue: 0,
      },
      loading: false,
    };
    renderDashboard();
    const insideTile = tileFor('Inside Now');
    const enteredTile = tileFor('Entered Today');
    expect(insideTile.textContent).toContain('4');
    expect(enteredTile.textContent).toContain('9');
    expect(insideTile.textContent).not.toBe(enteredTile.textContent);
  });

  // Every tile drills down IN PLACE. None of them may be a link — navigating
  // away to answer "which ones?" is the behaviour this replaced.
  it.each([
    ['Pre-approved', 'preApproved'],
    ['Walk-ins Approved', 'walkInApproved'],
    ['Inside Now', 'inside'],
    ['Entered Today', 'entered'],
    ['Checked Out', 'checkedOut'],
    ['Declined', 'declined'],
    ['No Show', 'noShow'],
  ])('%s is a button that expands its own drill-down on the same page', (label, key) => {
    mockToday.current = {
      visits: [{ id: 'v1', visitor: { full_name: 'Alice Johnson' } }],
      loading: false,
    };
    renderDashboard();
    const tile = tileFor(label);
    expect(tile.tagName).toBe('BUTTON');
    expect(screen.getByText(label).closest('a')).toBeNull();

    expect(screen.queryByTestId('drilldown-panel')).toBeNull();
    fireEvent.click(tile);
    const panel = screen.getByTestId('drilldown-panel');
    expect(panel).toHaveAttribute('data-key', key);
    expect(tile).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
  });

  it('re-clicking the open tile collapses its drill-down', () => {
    renderDashboard();
    const tile = tileFor('Inside Now');
    fireEvent.click(tile);
    expect(screen.getByTestId('drilldown-panel')).toBeInTheDocument();
    fireEvent.click(tile);
    expect(screen.queryByTestId('drilldown-panel')).toBeNull();
    expect(tile).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking a different tile swaps the drill-down instead of stacking a second one', () => {
    renderDashboard();
    fireEvent.click(tileFor('Inside Now'));
    expect(screen.getByTestId('drilldown-panel')).toHaveAttribute('data-key', 'inside');

    fireEvent.click(tileFor('Declined'));
    expect(screen.getAllByTestId('drilldown-panel')).toHaveLength(1);
    expect(screen.getByTestId('drilldown-panel')).toHaveAttribute('data-key', 'declined');
    expect(tileFor('Inside Now')).toHaveAttribute('aria-expanded', 'false');
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
    expect(screen.queryByText('Awaiting approval from person to meet')).toBeNull();
    expect(screen.queryByText('Expected to arrive')).toBeNull();
    expect(screen.queryByText('Overdue arrivals')).toBeNull();
  });

  // Regression guard: "Expected" hid that pre-approvals (booked ahead) and
  // walk-ins approved at the gate are two different populations, each with
  // its own console page now. Must not silently reappear as a merged tile.
  it('does not render a single merged "Expected" tile', () => {
    renderDashboard();
    expect(screen.queryByText('Expected')).toBeNull();
  });

  // Regression guard: the dashboard used to duplicate the console with its own
  // Recent Activity feed. Every row it listed was already one click away
  // inside the tile that counts it, so the feed was removed for good — see
  // the comment in Dashboard.tsx above where it used to render. Must not
  // silently reappear even when useRecentActivity has data to show.
  it('renders no Recent Activity feed, even when there is activity data', () => {
    mockActivity.current = {
      visits: [
        { id: 'a1', status: 'checked_out', checked_in_at: '2026-08-02T09:00:00Z', created_at: '2026-08-02T08:00:00Z', visitor: { full_name: 'Priya Nair' } } as any,
        { id: 'a2', status: 'checked_in', checked_in_at: '2026-08-02T10:00:00Z', created_at: '2026-08-02T10:00:00Z', visitor: { full_name: 'Rahul Verma' } } as any,
      ],
      loading: false,
    };
    renderDashboard();
    expect(screen.queryByText('Recent Activity')).toBeNull();
    expect(screen.queryByText('Priya Nair')).toBeNull();
    expect(screen.queryByText('Rahul Verma')).toBeNull();
  });
});
