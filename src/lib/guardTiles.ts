import type { ReportVisit } from './reportRow';
import type { VisitStatus } from '../types/index';
import { isOverstaying } from './visitExpiry';
import { isApprovedWalkIn } from './visitOrigin';

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

// Seven tiles, two rows. The first four are the gate's own board; the last
// three came off the Visitors tab's KPI rail on 2026-08-15 (client
// instruction), so a guard reads one board instead of comparing two screens.
// They keep the SAME rule as the other four — the tile's count is the length of
// the list it opens — which is the entire reason they were moved here as
// predicates rather than as a second rail with its own query.
//
// `walkin` did NOT come with them: it was never a count, it was the button that
// opens the walk-in registration form, and a form does not belong in a board of
// numbers. It is its own left-hand nav item now (/guard/walk-in).
export type GuardTileKey =
  | 'expected' | 'checked' | 'inside' | 'overstaying'
  | 'all' | 'pending' | 'walkinApproved'
  | 'declinedByHost' | 'refusedByGuard';

/** Row 1 — the gate's own board. */
export const GUARD_TILE_KEYS: GuardTileKey[] = ['expected', 'checked', 'inside', 'overstaying'];

/** Row 2 — the lanes that used to live on the Visitors tab, plus the two
 *  refusal lanes (client instruction, 2026-08-15). */
export const VISITOR_TILE_KEYS: GuardTileKey[] = [
  'all', 'pending', 'walkinApproved', 'declinedByHost', 'refusedByGuard',
];

// A refusal is ONE status and TWO events. `visits.status = 'rejected'` is
// written both when an HOD declines a request — usually before the visitor ever
// left home — and when a guard refuses someone at the door. Those are very
// different things to have on a record, and CLAUDE.md has always forbidden
// printing "entry denied" for an HOD's decision.
//
// What separates them is the ACTOR, not the status: `log_visit_approval` stamps
// every `visit_rejected` audit row with `auth.uid()`, and `attachVisitActors`
// resolves that into `actor.role` on the way into `useTodayVisits`. Migration
// 043 lets a guard read audit rows for visits they can already see, so this
// resolves on the guard's own session rather than being an admin-only fact.
//
// An unresolved actor counts as the HOST's decline. It is the only refusal path
// the app can still create — Deny Entry was removed on 2026-08-15 — so a row
// with no readable audit line is far likelier to be an HOD's decision than a
// guard's, and filing it under the guard would put a refusal-at-the-door on a
// person's record on the strength of a missing row.
const isGuardRefusal = (v: ReportVisit) => v.actor?.role === 'guard';

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

  // ── The three lanes moved off the Visitors tab (2026-08-15) ──────────────
  // Deliberately the SAME predicates as SEGMENT_FILTER in lib/visitorSegments.ts,
  // because they are the same questions. They are restated here rather than
  // imported so this file stays the one place the dashboard's counts come from;
  // if the two ever have to differ, that is a decision to make explicitly.

  // Everything on the board. No filter is the point — this is the tile a guard
  // presses to stop filtering.
  all: () => true,

  // A walk-in standing at the gate with nobody's decision on it yet. Not
  // "expected" (nobody cleared them) and not refused — simply unanswered.
  pending: (v) => v.status === 'pending_approval',

  // Every walk-in the host cleared, whether they are still at the gate or have
  // since been let in. Keyed on the CLEARANCE, not on the holding status: since
  // migration 080 the approver admits the visitor in the same click, so a row
  // passes straight from `pending_approval` to `checked_in` and would never be
  // seen by a `status === 'walkin_approved'` test. Shared with SEGMENT_FILTER
  // and the HOD's own tile — one question, one answer.
  walkinApproved: (v) => isApprovedWalkIn(v),

  // The host said no, usually before the visitor set off. NOT "entry denied".
  declinedByHost: (v) => v.status === 'rejected' && !isGuardRefusal(v),

  // A guard turned someone away at the door — the far heavier event, and the
  // one somebody may later be asked to account for, which is why it gets its
  // own number instead of being averaged into the one above.
  refusedByGuard: (v) => v.status === 'rejected' && isGuardRefusal(v),
};

/** The visits behind each tile, sliced from one already-loaded day. */
export function tileVisits(visits: ReportVisit[], now: Date = new Date()): Record<GuardTileKey, ReportVisit[]> {
  return {
    expected: visits.filter((v) => TILE_FILTER.expected(v, now)),
    checked: visits.filter((v) => TILE_FILTER.checked(v, now)),
    inside: visits.filter((v) => TILE_FILTER.inside(v, now)),
    overstaying: visits.filter((v) => TILE_FILTER.overstaying(v, now)),
    all: visits.filter((v) => TILE_FILTER.all(v, now)),
    pending: visits.filter((v) => TILE_FILTER.pending(v, now)),
    walkinApproved: visits.filter((v) => TILE_FILTER.walkinApproved(v, now)),
    declinedByHost: visits.filter((v) => TILE_FILTER.declinedByHost(v, now)),
    refusedByGuard: visits.filter((v) => TILE_FILTER.refusedByGuard(v, now)),
  };
}
