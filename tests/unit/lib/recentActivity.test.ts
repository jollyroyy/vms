import { describe, it, expect } from 'vitest';
import { recentActivity } from '../../../src/lib/recentActivity';
import type { ReportVisit } from '../../../src/lib/reportRow';

// The Recent Activity feed is DERIVED from the day the dashboard already
// fetched (useTodayVisits) — it does not run a query of its own. That is the
// whole reason it can come back: the objection to the original feed was a
// second subscription telling a different story from the tiles above it. Same
// rows in, so the feed and the counts cannot disagree.

function visit(over: Partial<ReportVisit> & { id: string }): ReportVisit {
  return {
    status: 'checked_in',
    checked_in_at: null,
    checked_out_at: null,
    created_at: '2026-08-13T03:00:00Z',
    actorAt: null,
    visitor: { full_name: 'Someone' },
    ...over,
  } as unknown as ReportVisit;
}

describe('recentActivity', () => {
  it('returns nothing for an empty day', () => {
    expect(recentActivity([])).toEqual([]);
  });

  it('reads an arrival off checked_in_at', () => {
    const events = recentActivity([visit({ id: 'a', checked_in_at: '2026-08-13T04:12:00Z' })]);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('entry');
    expect(events[0].at).toBe('2026-08-13T04:12:00Z');
  });

  it('yields BOTH an entry and an exit for one completed visit, newest first', () => {
    // One visit is two things that happened, not one. A feed that showed only
    // the latest state per row would silently drop every arrival as soon as
    // the visitor left — which is exactly the half of the day a guard scrolls
    // back to check.
    const events = recentActivity([visit({
      id: 'a',
      status: 'checked_out',
      checked_in_at: '2026-08-13T04:00:00Z',
      checked_out_at: '2026-08-13T06:30:00Z',
    })]);
    expect(events.map((e) => e.kind)).toEqual(['exit', 'entry']);
    expect(events[0].visit.id).toBe('a');
    expect(events[1].visit.id).toBe('a');
  });

  it('gives every event a distinct id so two events on one visit can both render', () => {
    const events = recentActivity([visit({
      id: 'a',
      status: 'checked_out',
      checked_in_at: '2026-08-13T04:00:00Z',
      checked_out_at: '2026-08-13T06:30:00Z',
    })]);
    expect(new Set(events.map((e) => e.id)).size).toBe(2);
  });

  it('orders across visits by when the event happened, newest first', () => {
    const events = recentActivity([
      visit({ id: 'a', checked_in_at: '2026-08-13T04:00:00Z' }),
      visit({ id: 'c', checked_in_at: '2026-08-13T09:00:00Z' }),
      visit({ id: 'b', checked_in_at: '2026-08-13T07:00:00Z' }),
    ]);
    expect(events.map((e) => e.visit.id)).toEqual(['c', 'b', 'a']);
  });

  it('records a declined request at the moment the HOD acted', () => {
    const events = recentActivity([visit({
      id: 'a', status: 'rejected', actorAt: '2026-08-13T05:00:00Z',
    })]);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('declined');
    expect(events[0].at).toBe('2026-08-13T05:00:00Z');
  });

  it('falls back to created_at when a declined visit has no audit timestamp', () => {
    const events = recentActivity([visit({ id: 'a', status: 'rejected' })]);
    expect(events[0].at).toBe('2026-08-13T03:00:00Z');
  });

  it('does not invent an event for a visit that has not happened yet', () => {
    // `approved` means booked and waiting. Nothing has occurred at the gate,
    // so nothing belongs in a log of what occurred.
    expect(recentActivity([visit({ id: 'a', status: 'approved' })])).toEqual([]);
    expect(recentActivity([visit({ id: 'b', status: 'pending_approval' })])).toEqual([]);
  });

  it('skips a timestamp it cannot parse rather than sorting it to the top', () => {
    const events = recentActivity([
      visit({ id: 'bad', checked_in_at: 'not-a-date' }),
      visit({ id: 'good', checked_in_at: '2026-08-13T04:00:00Z' }),
    ]);
    expect(events.map((e) => e.visit.id)).toEqual(['good']);
  });

  it('caps the feed at the requested length, keeping the newest', () => {
    const events = recentActivity([
      visit({ id: 'a', checked_in_at: '2026-08-13T04:00:00Z' }),
      visit({ id: 'b', checked_in_at: '2026-08-13T05:00:00Z' }),
      visit({ id: 'c', checked_in_at: '2026-08-13T06:00:00Z' }),
    ], 2);
    expect(events.map((e) => e.visit.id)).toEqual(['c', 'b']);
  });
});
