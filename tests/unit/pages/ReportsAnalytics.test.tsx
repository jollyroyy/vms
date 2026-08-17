import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import ReportsAnalytics from '../../../src/pages/Shared/ReportsAnalytics';

// ReportsAnalytics is a pure presentational component — `visits`, `from` and
// `to` come in as props, with no hook and no supabase call of its own — so
// unlike the other three pages in this task, no mock is needed at all. Every
// figure is asserted through the charts' `sr-only` label/value lists per
// CLAUDE.md, never through SVG path geometry.

function visit(over: Record<string, any> = {}): any {
  return {
    id: 'v1', status: 'checked_in', checked_in_at: null, purpose: 'meeting',
    checkin_duration_seconds: null, entry_point: null,
    ...over,
  };
}

function srListTexts(region: HTMLElement): string[] {
  return within(region).getAllByRole('listitem').map((li) => li.textContent ?? '');
}

describe('ReportsAnalytics', () => {
  afterEach(cleanup);

  it('renders all four cards with headings', () => {
    render(<ReportsAnalytics visits={[]} from="2026-08-17" to="2026-08-17" />);
    for (const heading of ['Visitors by Day', 'Avg Check-in Time Trend', 'Visit Purpose Split', 'Entry Point Utilization']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('shows each empty-data chart\'s own message, and still draws zero-stub bars rather than an empty message', () => {
    render(<ReportsAnalytics visits={[]} from="2026-08-15" to="2026-08-17" />);

    // Donut, line and utilization rows have genuinely nothing to plot.
    expect(screen.getByText('No arrivals to break down.')).toBeInTheDocument();
    expect(screen.getByText('No check-in in this range was timed.')).toBeInTheDocument();
    expect(screen.getByText('No arrival in this range recorded an entry point.')).toBeInTheDocument();

    // visitorsByDay always returns one entry per day in the range, valued
    // zero — a day with no visitors is a fact, not a missing data point
    // (BarChart's own doc). So "No arrivals in this range." must NOT show;
    // three zero-value bars draw instead.
    expect(screen.queryByText('No arrivals in this range.')).toBeNull();
    const byDayRegion = screen.getByRole('region', { name: 'Visitors by Day' });
    const values = srListTexts(byDayRegion);
    expect(values).toHaveLength(3);
    for (const v of values) expect(v).toMatch(/: 0$/);
  });

  it('does not print the "N of M days" line when the trend covers every day in the range', () => {
    render(<ReportsAnalytics
      visits={[visit({ id: 'a', checked_in_at: '2026-08-17T08:00:00Z', checkin_duration_seconds: 100 })]}
      from="2026-08-17" to="2026-08-17"
    />);
    expect(screen.queryByText(/days carried a measured check-in/)).toBeNull();
  });

  it('renders correct values across all four charts, and the "N of M" line when the trend is shorter than the range', () => {
    const visits = [
      // 08-15: one arrival, unmeasured check-in duration, entry point recorded.
      visit({
        id: 'a', checked_in_at: '2026-08-15T09:00:00Z', purpose: 'meeting',
        checkin_duration_seconds: null, entry_point: { name: 'Gate A' },
      }),
      // 08-16: two arrivals — one measured (200s, Gate A), one unmeasured with
      // no entry point recorded at all (counted separately, never folded into a gate).
      visit({
        id: 'b', checked_in_at: '2026-08-16T09:00:00Z', purpose: 'vendor',
        checkin_duration_seconds: 200, entry_point: { name: 'Gate A' },
      }),
      visit({
        id: 'c', checked_in_at: '2026-08-16T10:00:00Z', purpose: 'delivery',
        checkin_duration_seconds: null, entry_point: null,
      }),
      // 08-17: one arrival, measured (150s, Gate B).
      visit({
        id: 'd', checked_in_at: '2026-08-17T08:00:00Z', purpose: 'meeting',
        checkin_duration_seconds: 150, entry_point: { name: 'Gate B' },
      }),
    ];

    render(<ReportsAnalytics visits={visits} from="2026-08-15" to="2026-08-17" />);

    // Visitors by Day: 1, 2, 1 across the three days, in date order.
    const byDay = srListTexts(screen.getByRole('region', { name: 'Visitors by Day' }));
    expect(byDay[0]).toMatch(/: 1$/);
    expect(byDay[1]).toMatch(/: 2$/);
    expect(byDay[2]).toMatch(/: 1$/);

    // Trend: only 08-16 (avg 200/1=200s -> "3m 20s") and 08-17 (150s -> "2m 30s")
    // carried a measurement — 08-15's visit was never timed, so the trend is
    // shorter than the 3-day range and the coverage line must show.
    const trendRegion = screen.getByRole('region', { name: 'Avg Check-in Time Trend' });
    const trend = srListTexts(trendRegion);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatch(/3m 20s$/);
    expect(trend[1]).toMatch(/2m 30s$/);
    expect(within(trendRegion).getByText('2 of 3 days carried a measured check-in.')).toBeInTheDocument();

    // Purpose split: meeting (2) ranked above vendor (1) and delivery (1).
    const purposeRegion = screen.getByRole('region', { name: 'Visit Purpose Split' });
    const purposeList = within(purposeRegion).getAllByRole('listitem').map((li) => li.textContent);
    expect(purposeList[0]).toMatch(/Meetings/);
    expect(purposeList[0]).toMatch(/50%/); // meeting is 2 of the 4 total arrivals

    // Entry Point Utilization: Gate A (2) above Gate B (1); 1 unrecorded arrival flagged.
    const usageRegion = screen.getByRole('region', { name: 'Entry Point Utilization' });
    expect(within(usageRegion).getByText('Gate A')).toBeInTheDocument();
    expect(within(usageRegion).getByText('Gate B')).toBeInTheDocument();
    expect(within(usageRegion).getByText('1 arrival in this range recorded no entry point and is not counted above.')).toBeInTheDocument();
  });

  it('does not print the unrecorded-entry-point sentence when every arrival recorded one', () => {
    const visits = [
      visit({ id: 'a', checked_in_at: '2026-08-17T08:00:00Z', entry_point: { name: 'Gate A' } }),
      visit({ id: 'b', checked_in_at: '2026-08-17T09:00:00Z', entry_point: { name: 'Gate B' } }),
    ];
    render(<ReportsAnalytics visits={visits} from="2026-08-17" to="2026-08-17" />);
    expect(screen.queryByText(/recorded no entry point/)).toBeNull();
  });
});
