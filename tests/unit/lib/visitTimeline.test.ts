// The visit timeline: approval (pre-approved only), check-in, check-out.
//
// The rule under test is the one the client stated: the DATE appears once and
// the TIME appears on every entry — except when the entries span more than one
// IST day, where collapsing the date would let a stay that crossed midnight
// read as one that did not.
import { describe, it, expect } from 'vitest';
import { buildVisitTimeline, type TimelineVisit } from '../../../src/lib/visitTimeline';

// 05:00Z = 10:30 IST, 12:00Z = 17:30 IST, 19:00Z = 00:30 IST the NEXT day.
function visit(over: Partial<TimelineVisit> = {}): TimelineVisit {
  return {
    status: 'checked_in',
    created_at: '2026-08-14T03:00:00Z',
    scheduled_for: '2026-08-14T05:00:00Z',
    checked_in_at: null,
    checked_out_at: null,
    ...over,
  } as TimelineVisit;
}

describe('buildVisitTimeline', () => {
  it('shows the approval instant for a pre-approved visitor', () => {
    const t = buildVisitTimeline(visit({ approvedAt: '2026-08-14T03:00:00Z' }));
    expect(t.entries.map((e) => e.key)).toContain('approved');
    expect(t.entries.find((e) => e.key === 'approved')?.label).toBe('Approved');
  });

  it('omits the approval instant for a walk-in', () => {
    // No scheduled_for and a converged status => visitOrigin infers walk_in.
    const t = buildVisitTimeline(
      visit({ scheduled_for: null, checked_in_at: '2026-08-14T05:00:00Z', approvedAt: '2026-08-14T03:00:00Z' }),
    );
    expect(t.entries.map((e) => e.key)).toEqual(['checked_in']);
  });

  it('carries the check-in and check-out times', () => {
    const t = buildVisitTimeline(visit({
      status: 'checked_out',
      approvedAt: '2026-08-14T03:00:00Z',
      checked_in_at: '2026-08-14T05:00:00Z',
      checked_out_at: '2026-08-14T12:00:00Z',
    }));
    expect(t.entries.map((e) => e.key)).toEqual(['approved', 'checked_in', 'checked_out']);
    // IST, not the runner's timezone.
    expect(t.entries.find((e) => e.key === 'checked_in')?.time).toMatch(/10:30/);
    expect(t.entries.find((e) => e.key === 'checked_out')?.time).toMatch(/5:30|17:30/);
  });

  it('prints the date ONCE when every entry falls on the same IST day', () => {
    const t = buildVisitTimeline(visit({
      status: 'checked_out',
      approvedAt: '2026-08-14T03:00:00Z',
      checked_in_at: '2026-08-14T05:00:00Z',
      checked_out_at: '2026-08-14T12:00:00Z',
    }));
    expect(t.date).toMatch(/14 Aug 2026/);
    expect(t.entries.every((e) => e.date === null)).toBe(true);
  });

  it('gives every entry its own date when the visit spans more than one IST day', () => {
    // Checked out at 19:00Z = 00:30 IST on 15 Aug — a different IST day.
    const t = buildVisitTimeline(visit({
      status: 'checked_out',
      checked_in_at: '2026-08-14T05:00:00Z',
      checked_out_at: '2026-08-14T19:00:00Z',
    }));
    expect(t.date).toBeNull();
    expect(t.entries.find((e) => e.key === 'checked_in')?.date).toMatch(/14 Aug 2026/);
    expect(t.entries.find((e) => e.key === 'checked_out')?.date).toMatch(/15 Aug 2026/);
  });

  it('returns no entries when nothing timeable has happened yet', () => {
    const t = buildVisitTimeline(visit({ status: 'pending_approval', scheduled_for: null }));
    expect(t.entries).toEqual([]);
    expect(t.date).toBeNull();
  });

  it('drops an unparseable timestamp rather than printing "Invalid Date"', () => {
    const t = buildVisitTimeline(visit({ approvedAt: '2026-08-14T03:00:00Z', checked_in_at: 'not-a-date' }));
    // The approval survives; only the unusable entry is dropped.
    expect(t.entries.map((e) => e.key)).toEqual(['approved']);
    expect(t.entries[0].time).not.toMatch(/invalid/i);
  });
});
