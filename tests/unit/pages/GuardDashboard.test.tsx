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
  entered: 0, inside: 0, checkedOut: 0, declined: 0,
  noShow: 0, awaitingApproval: 0, overdue: 0, overstaying: 0,
};

const mockStats = vi.hoisted(() => ({
  current: {
    stats: {
      entered: 0, inside: 0, checkedOut: 0, declined: 0,
      noShow: 0, awaitingApproval: 0, overdue: 0, overstaying: 0,
    },
    loading: false,
  },
}));
const mockToday = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useGateStats', () => ({
  useGateStats: () => mockStats.current,
}));

vi.mock('../../../src/lib/useTodayVisits', () => ({
  useTodayVisits: () => mockToday.current,
}));

// Heavy children irrelevant to these tests — stubbed to keep this file focused
// on the composition Dashboard.tsx owns. Each has its own test file. The
// drill-down keeps a minimal stand-in that echoes which key it was opened with,
// so the expand/collapse behaviour and the tile→panel wiring can still be
// observed; the activity stub echoes how many visits it was handed, which is
// the one thing the parent is responsible for getting right.
vi.mock('../../../src/pages/Guard/DashboardDrilldown', () => ({
  default: ({ drillKey, visits }: { drillKey: string; visits: any[] }) => (
    <div data-testid="drilldown-panel" data-key={drillKey}>
      {visits.map((v) => <span key={v.id}>{v.visitor?.full_name}</span>)}
    </div>
  ),
}));

vi.mock('../../../src/pages/Guard/DashboardActivity', () => ({
  default: ({ visits }: { visits: any[] }) => (
    <div data-testid="activity-panel" data-count={visits.length}>Recent Activity</div>
  ),
}));

vi.mock('../../../src/pages/Guard/DashboardQuickActions', () => ({
  default: () => <div data-testid="quick-actions">Quick Actions</div>,
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

const TILE_LABELS = [
  'Entries', 'Exits', 'Currently Inside', 'Overstaying', 'No-shows', 'Declined',
];

describe('GuardDashboard', () => {
  afterEach(() => {
    cleanup();
    mockStats.current = { stats: { ...EMPTY_STATS }, loading: false };
    mockToday.current = { visits: [], loading: false };
  });

  // No page heading (client instruction, 2026-08-13). The sidebar item the
  // guard just clicked already says "Dashboard"; the page restating its own
  // name spent the widest line on screen on the one fact they cannot be in
  // doubt about. The date, the Live pill and the clock all stay — those are
  // things only the page can tell them.
  it('does not restate its own name as a page heading', () => {
    renderDashboard();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('still shows the live clock header beside the date', () => {
    renderDashboard();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders all six KPI tile labels', () => {
    renderDashboard();
    for (const label of TILE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  // Both approval counts belong to the Visitors surface, which carries its own
  // tile and its own list for each. A second copy here was one number on two
  // screens behind two independent queries. Client instruction, 2026-08-13.
  it('does not carry the Pre-approved or Walk-ins Approved tile', () => {
    renderDashboard();
    expect(screen.queryByText('Pre-approved')).toBeNull();
    expect(screen.queryByText('Walk-ins Approved')).toBeNull();
  });

  it('shows zeros for every tile when there is no data (empty state)', () => {
    renderDashboard();
    for (const label of TILE_LABELS) {
      expect(tileFor(label).textContent).toContain('0');
    }
  });

  it('renders seeded stats on their matching tiles', () => {
    mockStats.current = {
      stats: {
        inside: 3, entered: 8, checkedOut: 5, declined: 2,
        noShow: 6, awaitingApproval: 1, overdue: 0, overstaying: 7,
      },
      loading: false,
    };
    renderDashboard();
    expect(tileFor('Currently Inside').textContent).toContain('3');
    expect(tileFor('Entries').textContent).toContain('8');
    expect(tileFor('Exits').textContent).toContain('5');
    expect(tileFor('Declined').textContent).toContain('2');
    expect(tileFor('No-shows').textContent).toContain('6');
    expect(tileFor('Overstaying').textContent).toContain('7');
  });

  // Regression guard: Currently Inside (live, status === 'checked_in') and
  // Entries (cumulative, checked_in_at !== null) must never collapse into the
  // same number. Here inside=4, checkedOut=5, entered=9 (4 + 5), so the two
  // tiles must show 4 and 9 respectively — not the same value.
  it('shows Currently Inside and Entries as different, independently correct numbers', () => {
    mockStats.current = {
      stats: {
        inside: 4, entered: 9, checkedOut: 5, declined: 0,
        noShow: 0, awaitingApproval: 0, overdue: 0, overstaying: 0,
      },
      loading: false,
    };
    renderDashboard();
    const insideTile = tileFor('Currently Inside');
    const enteredTile = tileFor('Entries');
    expect(insideTile.textContent).toContain('4');
    expect(enteredTile.textContent).toContain('9');
    expect(insideTile.textContent).not.toBe(enteredTile.textContent);
  });

  // Every tile drills down IN PLACE. None of them may be a link — navigating
  // away to answer "which ones?" is the behaviour this replaced. The reference
  // design's chevron on each card promises exactly this, and nothing else.
  it.each([
    ['Entries', 'entered'],
    ['Exits', 'checkedOut'],
    ['Currently Inside', 'inside'],
    ['Overstaying', 'overstaying'],
    ['No-shows', 'noShow'],
    ['Declined', 'declined'],
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
    const tile = tileFor('Currently Inside');
    fireEvent.click(tile);
    expect(screen.getByTestId('drilldown-panel')).toBeInTheDocument();
    fireEvent.click(tile);
    expect(screen.queryByTestId('drilldown-panel')).toBeNull();
    expect(tile).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking a different tile swaps the drill-down instead of stacking a second one', () => {
    renderDashboard();
    fireEvent.click(tileFor('Currently Inside'));
    expect(screen.getByTestId('drilldown-panel')).toHaveAttribute('data-key', 'inside');

    fireEvent.click(tileFor('Declined'));
    expect(screen.getAllByTestId('drilldown-panel')).toHaveLength(1);
    expect(screen.getByTestId('drilldown-panel')).toHaveAttribute('data-key', 'declined');
    expect(tileFor('Currently Inside')).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the Recent Activity panel and the Quick Actions panel', () => {
    renderDashboard();
    expect(screen.getByTestId('activity-panel')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  // The feed is DERIVED from the same day the tiles count, not fetched
  // separately. That is the whole reason it could come back: the original was
  // deleted for running its own query alongside the tiles, so the two could
  // disagree about the same day with nothing to reconcile them. If this ever
  // stops being fed `todayVisits`, that failure mode is back.
  it('hands the activity panel the same visits the drill-downs use', () => {
    mockToday.current = {
      visits: [{ id: 'v1', visitor: { full_name: 'A' } }, { id: 'v2', visitor: { full_name: 'B' } }],
      loading: false,
    };
    renderDashboard();
    expect(screen.getByTestId('activity-panel')).toHaveAttribute('data-count', '2');
  });

  // The section heading above the grid already says "Today". A tile repeating
  // it underneath is the same word twice in one glance — removed 2026-08-13.
  // Asserted on the tile's own text, not the page's, so the heading itself is
  // free to keep saying it.
  it('does not repeat "Today" as a subtext under any tile', () => {
    renderDashboard();
    for (const label of TILE_LABELS) {
      expect(tileFor(label).textContent).not.toMatch(/Today/);
    }
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

  // Regression guard: the reference design labelled the `rejected` tile "Entry
  // Denied". It is not the guard turning someone away at the door — it is an
  // HOD declining the request, usually before the visitor ever left home.
  it('never labels declined requests as denied entry', () => {
    renderDashboard();
    expect(screen.queryByText(/denied/i)).toBeNull();
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  // Regression guard: a guard must never be able to mint an entry pass, so the
  // reference design's "Issue Pass" quick action has no home on this surface.
  it('offers no way to issue a pass', () => {
    renderDashboard();
    expect(screen.queryByText(/issue pass/i)).toBeNull();
  });
});
