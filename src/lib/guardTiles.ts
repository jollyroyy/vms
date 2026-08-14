import type { ReportVisit } from './reportRow';
import type { VisitStatus } from '../types/index';
import { isOverstaying } from './visitExpiry';

// The guard dashboard's four KPI tiles, as PREDICATES over the day's visits.
//
// This file exists because the tile count and the drill-down list underneath it
// used to be computed from two different rules over two different queries —
// `useGateStats` for the number, an inline `visits.filter(...)` for the cards.
// Nothing forced them to agree, and they did not: the "Pending Check-out" tile
// counted overstayers while its panel listed everyone inside who had a departure
// time set, so a tile reading 1 could open onto five cards.
//
// One predicate per tile, used for BOTH the number and the list, is the whole
// fix: `count = visits.filter(TILE_FILTER[k]).length` and the panel renders that
// same array. They cannot drift, because there is nothing to drift from.
//
// Keep these pure and injectable-clock where time matters — they are the unit of
// truth the tests pin, and a predicate that reads the wall clock internally
// cannot be tested for the boundary cases that actually bite.

export type GuardTileKey = 'expected' | 'checked' | 'inside' | 'overstaying';

export const GUARD_TILE_KEYS: GuardTileKey[] = ['expected', 'checked', 'inside', 'overstaying'];

// Which statuses mean "approved and still expected at the gate". A pre-approval
// is INSERTed already `approved`; a walk-in becomes `walkin_approved` when the
// HOD says yes. Lookup map rather than an includes() chain, per CLAUDE.md.
//
// `pending_approval` is deliberately NOT here. That visitor is standing at the
// gate with no decision made — they are not expected, they are *unanswered*, and
// counting them as expected told the guard someone had been cleared who had not.
const IS_EXPECTED: Partial<Record<VisitStatus, true>> = {
  approved: true,
  walkin_approved: true,
};

export const TILE_FILTER: Record<GuardTileKey, (v: ReportVisit, now?: Date) => boolean> = {
  // Approved, not yet through the gate. This is the tile's plain meaning and it
  // was NOT what the old formula computed: that was `awaitingApproval + overdue`
  // — unapproved walk-in requests plus approved visitors who are already late —
  // which omitted the ordinary case entirely. A visitor booked for 3pm, read at
  // 10am, was in neither term, so the tile showed 0 on a fully booked morning.
  expected: (v) => IS_EXPECTED[v.status] === true && !v.checked_in_at,

  // Cumulative: everyone who came through the gate today, whether or not they
  // are still here. `status` holds ONE value, so a visitor who came and left is
  // `checked_out` — counting `status === 'checked_in'` would answer "who is
  // still here", never "how many came through". The invariant this preserves:
  // checked === inside + (those who have since left).
  checked: (v) => v.checked_in_at !== null,

  // Live: still on the premises. This is the list you hand a fire marshal.
  inside: (v) => v.status === 'checked_in',

  // Inside well past any plausible visit — almost always a check-out the gate
  // forgot. Worth attention BEFORE the nightly sweep closes it, because a guard
  // who acts records a witnessed exit where the sweep can only record that we
  // stopped believing the row (migration 067).
  overstaying: (v, now) => isOverstaying(v, now ?? new Date()),
};

/** The visits behind each tile, sliced from one already-loaded day. */
export function tileVisits(visits: ReportVisit[], now: Date = new Date()): Record<GuardTileKey, ReportVisit[]> {
  return {
    expected: visits.filter((v) => TILE_FILTER.expected(v, now)),
    checked: visits.filter((v) => TILE_FILTER.checked(v, now)),
    inside: visits.filter((v) => TILE_FILTER.inside(v, now)),
    overstaying: visits.filter((v) => TILE_FILTER.overstaying(v, now)),
  };
}
