import type { Visit } from '../types/index';
import { istDateKey } from './visitExpiry';
import { isPreRegisteredArrival } from './preRegisteredBoard';

// The Live Check-In tab's four lanes — one predicate each, `guardTiles.ts`'s
// rule again: a lane's badge is the length of the list that lane opens, so the
// number and the rows can never describe different sets.

/** Left since the IST day began. */
export function departedOn(v: Visit, dayKey: string): boolean {
  return v.checked_out_at !== null && v.checked_out_at !== undefined
    && istDateKey(v.checked_out_at) === dayKey;
}

// THERE IS NO `liveCheckInKpis` ANY MORE, and its removal is the point rather
// than a tidy-up (2026-08-17). The tab carried four tiles above three lists,
// and three of the four restated something already on the same screen or the
// screen next door:
//
//   - `currentlyInside` was the Inside lane's badge, four inches higher up.
//   - `departedToday` was the Checked Out lane's badge, likewise.
//   - `arrivedToday` was the Dashboard's "Visitors Today" tile, computed by
//     this file's own imported `arrivedOn` — one number under two labels.
//   - `awaitingApproval` was the only figure unique to this tab, and it was a
//     count with NO list to open, which is the inverse of the rule
//     `guardTiles.ts` states: a tile's count is the length of the list it
//     opens. It is a lane now, so the count and its rows are the same thing.
//
// What is left is three predicates and three lanes. The Dashboard tab reads
// today's SHAPE (trend against yesterday, hourly flow, purpose split, host
// ranking); this tab reads today's PEOPLE, by name. Neither states the other's
// figures.

/**
 * The Expected lane: today's pre-approvals that have not walked in yet —
 * which is what the whole Pre-Registration tab was for, folded in here on
 * client instruction (2026-08-18: merge pre-registration and live check-in,
 * drop whatever is redundant).
 *
 * WHAT WAS REDUNDANT: the tab was a HISTORICAL, ranged read of every booking
 * ever made, with its own date bar, three KPI tiles, a filter row and a pager
 * — and the admin's historical read of any visit, booking included, is the
 * Reports register. A booking that already arrived is in the Inside or Checked
 * Out lane beside this one; a booking that never did is in Reports, marked
 * `no_show`. What was left, and had no home, is the one thing this tab exists
 * to answer: who is the gate still expecting today.
 *
 * THE PREDICATE IS THE GUARD'S OWN (`isPreRegisteredArrival`), not a fourth
 * spelling of it. The guard's Pre-Registered board and Expected Today panel
 * already run off it, so the admin now watches the same list the gate is
 * working from — if the membership rule changes it changes in
 * `lib/preRegisteredBoard.ts` and all three follow.
 *
 * Soonest slot first: the top row is the next person through the door.
 */
export function expectedLane(visits: Visit[], now: Date = new Date()): Visit[] {
  return visits
    .filter((v) => isPreRegisteredArrival(v, now))
    .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''));
}

/** The Inside lane: everyone on site right now, oldest arrival first — the
 *  same ordering the guard's Entry & Exit tab uses, and for the same reason:
 *  the longest-present visitor is the one closest to an overstay. */
export function insideLane(visits: Visit[]): Visit[] {
  return visits
    .filter((v) => v.status === 'checked_in')
    .sort((a, b) => (a.checked_in_at ?? '').localeCompare(b.checked_in_at ?? ''));
}

/** The Checked Out lane: everyone who left since the IST day began, most
 *  recent departure first. */
export function departedLane(visits: Visit[], now: Date = new Date()): Visit[] {
  const today = istDateKey(now);
  return visits
    .filter((v) => departedOn(v, today))
    .sort((a, b) => (b.checked_out_at ?? '').localeCompare(a.checked_out_at ?? ''));
}

/**
 * The Awaiting Approval lane: walk-ins the gate registered that no host has
 * answered yet, longest wait first.
 *
 * NOT DATE-BOUNDED, and deliberately so — the same call `HODOverview`'s pending
 * query makes. A request raised at 23:50 is still somebody standing at the gate
 * at 00:05, and dropping it at midnight would hide the one row on this page
 * where the delay is the whole story. Migration 081's sweep is what eventually
 * closes these (to `lapsed`, at 22:00 IST), so the list cannot grow unbounded
 * — the open-ended list and the sweep that closes it are the two halves
 * migration 066 said never to ship apart.
 *
 * Oldest first: this is the only lane whose order is a priority rather than a
 * chronology, because the top row is the visitor who has been waiting longest.
 */
export function pendingLane(visits: Visit[]): Visit[] {
  return visits
    .filter((v) => v.status === 'pending_approval')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
