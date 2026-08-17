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

  // Migration 083 (2026-08-17): the host's yes is a clearance, not an
  // admission, so a cleared walk-in IS expected — approved and not yet through
  // the gate, which is this tile's plain meaning. It sat on Checked In for the
  // single day 080's shortcut was live. The no-contradiction rule that put it
  // there still holds; it just resolves the other way now, and `checked` is
  // keyed on the arrival stamp alone so the two tiles cannot both claim it.
  it('counts a walk-in the HOD has cleared but the gate has not stamped', () => {
    expect(TILE_FILTER.expected(v({ status: 'walkin_approved' }), NOW)).toBe(true);
    expect(TILE_FILTER.checked(v({ status: 'walkin_approved' }), NOW)).toBe(false);
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

  // Migration 083 (2026-08-17): a host-cleared walk-in has NOT come through the
  // gate. It counted as arrived for one day, while 080's shortcut meant an
  // approver's click admitted somebody without ever stamping `checked_in_at`.
  // With the admission back at the gate the stamp is written again on every
  // arrival, so counting the status too would put people still standing outside
  // on the arrivals tile. They are `expected` — cleared, not yet in.
  it('does not count a host-cleared walk-in as having come through the gate', () => {
    const cleared = v({ status: 'walkin_approved', scheduled_for: null, checked_in_at: null });
    expect(TILE_FILTER.checked(cleared, NOW)).toBe(false);
    expect(TILE_FILTER.expected(cleared, NOW)).toBe(true);
    // And never on the fire-marshal list, which was true under both regimes.
    expect(TILE_FILTER.inside(cleared, NOW)).toBe(false);
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
    // 'b' is a cleared walk-in — approved, waiting at the gate for a card and a
    // stamp (083), so it sits with the pre-registration 'a' rather than with
    // the arrivals. It moved out of `checked` and into `expected` on 2026-08-17.
    expect(t.expected.map((x) => x.id)).toEqual(['a', 'b']);
    expect(t.checked.map((x) => x.id)).toEqual(['c', 'd']);
    expect(t.inside.map((x) => x.id)).toEqual(['c']);
    expect(t.checkedOut.map((x) => x.id)).toEqual(['d']);
    // The invariant the board is read by: everyone who came through the gate
    // is either still here or has left.
    expect(t.checked.length).toBe(t.inside.length + t.checkedOut.length);
  });
});

// Checked Out Today (added 2026-08-17, client instruction). It is keyed on the
// EXIT TIMESTAMP against the IST day boundary, not on `status === 'checked_out'`
// — the same window the Entry & Exit tab's Checked Out lane uses, so the tile
// and that lane cannot report different figures for one day's exits.
describe('Checked Out Today', () => {
  // The IST day containing NOW (2026-08-14T12:00Z = 17:30 IST) opened at
  // 2026-08-13T18:30Z.
  it('counts a visitor who left after the IST day began', () => {
    expect(TILE_FILTER.checkedOut(
      v({ status: 'checked_out', checked_in_at: '2026-08-14T04:00:00Z', checked_out_at: '2026-08-14T08:00:00Z' }),
      NOW,
    )).toBe(true);
  });

  // The row the widened `useTodayVisits` window exists for: in at 21:00 IST
  // yesterday, out at 09:00 IST today. It belongs to today's exits.
  it('counts an exit that crossed midnight', () => {
    expect(TILE_FILTER.checkedOut(
      v({ status: 'checked_out', checked_in_at: '2026-08-13T15:30:00Z', checked_out_at: '2026-08-14T03:30:00Z' }),
      NOW,
    )).toBe(true);
  });

  // 2026-08-13T12:00Z is 17:30 IST on the 13th — before this IST day opened.
  it('does not count yesterday’s departure', () => {
    expect(TILE_FILTER.checkedOut(
      v({ status: 'checked_out', checked_in_at: '2026-08-13T09:00:00Z', checked_out_at: '2026-08-13T12:00:00Z' }),
      NOW,
    )).toBe(false);
  });

  // The UTC-midnight bug this predicate is written to avoid: 2026-08-14T01:00Z
  // is 06:30 IST today, and is after the IST boundary (2026-08-13T18:30Z) even
  // though a naive `${today}T00:00:00Z` comparison would also pass it. The case
  // that separates them is the one below.
  it('counts an exit made between 00:00 and 05:30 IST', () => {
    // 2026-08-13T19:00Z = 00:30 IST on the 14th. A UTC-midnight boundary of
    // 2026-08-14T00:00:00Z would wrongly exclude it.
    expect(TILE_FILTER.checkedOut(
      v({ status: 'checked_out', checked_in_at: '2026-08-13T14:00:00Z', checked_out_at: '2026-08-13T19:00:00Z' }),
      NOW,
    )).toBe(true);
  });

  it('does not count a visitor who is still inside', () => {
    expect(TILE_FILTER.checkedOut(
      v({ status: 'checked_in', checked_in_at: '2026-08-14T04:00:00Z' }),
      NOW,
    )).toBe(false);
  });
});
