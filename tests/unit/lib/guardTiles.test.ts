// The guard dashboard's four tiles, as predicates (src/lib/guardTiles.ts).
//
// This file exists because the tile NUMBER and the drill-down LIST used to be
// computed from two different rules over two different queries. The rule that
// matters here is the one that made that impossible: the count is the length of
// the list, so every case below pins both at once.
import { describe, it, expect } from 'vitest';
import { TILE_FILTER, tileVisits, GUARD_TILE_KEYS } from '../../../src/lib/guardTiles';
import type { ReportVisit } from '../../../src/lib/reportRow';

function v(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-1',
    status: 'approved',
    purpose: 'meeting',
    created_at: '2026-08-14T02:00:00Z',
    scheduled_for: '2026-08-14T04:00:00Z',
    checked_in_at: null,
    checked_out_at: null,
    expected_departure: null,
    ...over,
  } as unknown as ReportVisit;
}

const NOW = new Date('2026-08-14T12:00:00Z');

describe('Expected Today', () => {
  // The bug: the old formula was `awaitingApproval + overdue`, so a visitor
  // booked for 3pm and read at 10am counted in neither term. The tile showed 0
  // on a fully booked morning — the one reading a guard trusts first.
  it('counts an approved visitor whose slot has not arrived yet', () => {
    expect(TILE_FILTER.expected(v({ status: 'approved', scheduled_for: '2026-08-14T18:00:00Z' }), NOW)).toBe(true);
  });

  it('counts an approved visitor who is already overdue', () => {
    expect(TILE_FILTER.expected(v({ status: 'approved', scheduled_for: '2026-08-14T04:00:00Z' }), NOW)).toBe(true);
  });

  it('counts a walk-in the HOD approved', () => {
    expect(TILE_FILTER.expected(v({ status: 'walkin_approved' }), NOW)).toBe(true);
  });

  // Standing at the gate with no decision made is not "expected" — nobody has
  // cleared them, and counting them as expected says somebody did.
  it('does NOT count a walk-in still awaiting the HOD', () => {
    expect(TILE_FILTER.expected(v({ status: 'pending_approval' }), NOW)).toBe(false);
  });

  it('does NOT count someone already through the gate', () => {
    expect(TILE_FILTER.expected(v({ status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z' }), NOW)).toBe(false);
  });

  it.each(['rejected', 'no_show', 'expired', 'checked_out'] as const)('does NOT count a %s visit', (status) => {
    expect(TILE_FILTER.expected(v({ status }), NOW)).toBe(false);
  });
});

describe('Checked In vs In Premises', () => {
  // `status` holds ONE value, so a visitor who came and left is `checked_out`.
  // Counting `status === 'checked_in'` answers "who is still here", never "how
  // many came through today".
  const arrivedAndLeft = v({ status: 'checked_out', checked_in_at: '2026-08-14T09:00:00Z', checked_out_at: '2026-08-14T11:00:00Z' });
  const stillHere = v({ status: 'checked_in', checked_in_at: '2026-08-14T09:30:00Z' });

  it('counts a departed visitor as checked in today, but not as in premises', () => {
    expect(TILE_FILTER.checked(arrivedAndLeft, NOW)).toBe(true);
    expect(TILE_FILTER.inside(arrivedAndLeft, NOW)).toBe(false);
  });

  it('counts a present visitor in both', () => {
    expect(TILE_FILTER.checked(stillHere, NOW)).toBe(true);
    expect(TILE_FILTER.inside(stillHere, NOW)).toBe(true);
  });

  it('holds the invariant: checked === inside + departed', () => {
    const day = [arrivedAndLeft, stillHere, v({ status: 'approved' })];
    const t = tileVisits(day, NOW);
    expect(t.checked.length).toBe(t.inside.length + 1);
  });
});

describe('Overstaying', () => {
  it('counts a visitor inside well past the default window', () => {
    expect(TILE_FILTER.overstaying(v({ status: 'checked_in', checked_in_at: '2026-08-13T20:00:00Z' }), NOW)).toBe(true);
  });

  it('does not count a visitor who arrived an hour ago', () => {
    expect(TILE_FILTER.overstaying(v({ status: 'checked_in', checked_in_at: '2026-08-14T11:00:00Z' }), NOW)).toBe(false);
  });

  // The approver's answer beats the fallback: a contractor booked until Friday
  // is not overstaying on Tuesday night.
  it('respects an expected_departure that has not passed', () => {
    expect(TILE_FILTER.overstaying(
      v({ status: 'checked_in', checked_in_at: '2026-08-13T08:00:00Z', expected_departure: '2026-08-16T10:00:00Z' }),
      NOW,
    )).toBe(false);
  });
});

describe('tileVisits', () => {
  it('returns an array for every declared tile key', () => {
    const t = tileVisits([], NOW);
    for (const key of GUARD_TILE_KEYS) {
      expect(Array.isArray(t[key])).toBe(true);
    }
  });

  // The whole point: the number on the tile IS the list behind it.
  it('slices one day so each count equals the length of its own list', () => {
    const day = [
      v({ id: 'a', status: 'approved' }),
      v({ id: 'b', status: 'walkin_approved' }),
      v({ id: 'c', status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z' }),
      v({ id: 'd', status: 'checked_out', checked_in_at: '2026-08-14T07:00:00Z', checked_out_at: '2026-08-14T08:00:00Z' }),
      v({ id: 'e', status: 'pending_approval' }),
    ];
    const t = tileVisits(day, NOW);
    expect(t.expected.map((x) => x.id)).toEqual(['a', 'b']);
    expect(t.checked.map((x) => x.id)).toEqual(['c', 'd']);
    expect(t.inside.map((x) => x.id)).toEqual(['c']);
  });
});
