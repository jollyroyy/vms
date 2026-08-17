import type { Visit, Visitor } from '../types/index';
import { isOverstaying } from './visitExpiry';

// Every number and every list on the admin Blacklist & Security tab, derived
// here and nowhere else — the same rule adminDashboard.ts follows for the
// admin Dashboard, and guardTiles.ts follows for the guard board: a tile's
// figure and the rows it opens onto come from ONE predicate, so a count and
// its panel can never describe different sets. Pure over Visit[] / Visitor[],
// no queries, no hooks — every figure here is assertable in a unit test
// without touching Supabase.
//
// WHAT THIS FILE DOES NOT DO IS AS DELIBERATE AS WHAT IT DOES. There is no
// "who added this to the blacklist" anywhere in here, because `visitors`
// records no actor for the flag — inventing one would be a fabricated
// attribution on a record someone may later be asked to account for. See
// AdminBlacklistPanel.tsx.
//
// THIS TAB IS A MIX OF RANGED AND LIVE STATE, and the functions below are
// split into two families that must never be blurred together (client
// instruction, 2026-08-17: every historical admin tab carries a date range).
//
//   RANGED — deniedEntries / deniedEntriesCount / the blacklist half of
//   securityAlerts. Each is an EVENT that happened on a date (a refusal, a
//   blacklisted visitor turning up on a visit), so the caller narrows
//   `visits` to a chosen window with `useAdminVisits({ kind: 'range', ... })`
//   before it ever reaches these functions. They used to re-filter on
//   `istDateKey(v.created_at) === today` internally, which was correct only
//   while the caller's window WAS today — the moment the caller widened to a
//   90-day range, that internal filter would silently intersect with "today"
//   and return an empty set for every day but the last one. The date
//   narrowing now lives in exactly one place: the fetch.
//
//   LIVE — blacklistedVisitors / blacklistedCount / the overstay half of
//   securityAlerts. Neither can be ranged, because ranging either is
//   meaningless, not merely unhelpful: `visitors.is_blacklisted` carries no
//   history of the flag being set (see above — no actor, no timestamp), so
//   "who was flagged 60 days ago" is not a question this schema can answer,
//   only "who is flagged right now". An overstay is by definition a
//   right-now fact — someone still inside, past a deadline measured from
//   their entry — so a "60 days ago" overstay alert would describe a moment
//   that has already resolved one way or the other and tell nobody anything
//   useful. Both stay keyed on live state with no date test at all.
//
// Mixing the two families under one date filter would be a lie on screen: an
// admin who picks "Last 7 Days" and sees the Blacklisted count drop must be
// able to trust that means seven fewer people are flagged right now, not
// that the tab quietly stopped showing the rest of the roster.

/**
 * Everyone currently flagged. `visitors` carries no history of the flag being
 * set — no actor, no timestamp of the flagging itself — so this is a filter,
 * not a join. Kept as its own function (rather than inlined at the call site)
 * so the Blacklist panel is guarded even if the query feeding it is ever
 * widened past `is_blacklisted = true`. LIVE — never ranged, see header.
 */
export function blacklistedVisitors(visitors: Visitor[]): Visitor[] {
  return visitors.filter((v) => v.is_blacklisted);
}

/** Total flagged visitors — the length of the list above, never a second count. */
export function blacklistedCount(visitors: Visitor[]): number {
  return blacklistedVisitors(visitors).length;
}

/**
 * Visits that ended in a refusal, whichever desk refused them — an HOD
 * declining a request, or a guard refusing entry at the gate. Both are
 * `status === 'rejected'`; which one happened is on the row's `actor`
 * (lib/visitActors.ts), read in the panel, not decided here. RANGED: the
 * caller's `useAdminVisits({ kind: 'range', ... })` window has already
 * narrowed `visits` to the chosen dates, so this function filters on status
 * alone — re-testing a date here would intersect with the fetch window
 * rather than widen it, and would silently return nothing for any window
 * that is not today (see header comment).
 */
export function deniedEntries(visits: Visit[]): Visit[] {
  return visits.filter((v) => v.status === 'rejected');
}

/** The length of the list above — the KPI tile's number. */
export function deniedEntriesCount(visits: Visit[]): number {
  return deniedEntries(visits).length;
}

export type SecurityAlertKind = 'blacklist' | 'overstay';

export type SecurityAlert = {
  id: string;
  kind: SecurityAlertKind;
  title: string;
  /** One line: who, and why this needed a second look. */
  detail: string;
  /** The instant the alert is timed to — when the blacklisted visitor's visit
   *  was raised, or when the overstaying visitor checked in. */
  at: string;
};

/**
 * A blacklisted visitor showing up on the selected window's activity is not a
 * routine event — the flag exists precisely so this is noticed, whether they
 * were flagged before or after this visit was raised. Built from REAL rows
 * only: a visit whose joined visitor carries `is_blacklisted`. RANGED — see
 * header: the caller's fetch window has already narrowed `visits`, so this
 * takes every row it is given rather than re-testing a date.
 */
function blacklistAlerts(visits: Visit[]): SecurityAlert[] {
  return visits
    .filter((v) => v.visitor?.is_blacklisted)
    .map((v) => ({
      id: `blacklist-${v.id}`,
      kind: 'blacklist' as const,
      title: v.visitor?.full_name ?? 'Unknown visitor',
      detail: v.visitor?.blacklist_reason?.trim() || 'Blacklisted visitor has an active visit in this window',
      at: v.created_at,
    }));
}

/**
 * Someone still inside, past the deadline `isOverstaying` already uses for
 * the guard and admin dashboards — the same predicate, so this list and
 * those tiles can never disagree about who is overdue. LIVE — see header:
 * an overstay is a fact about this instant, never about a chosen window, so
 * this takes no window-narrowed `visits` at all and no date test.
 */
function overstayAlerts(visits: Visit[], now: Date = new Date()): SecurityAlert[] {
  return visits
    .filter((v) => v.status === 'checked_in' && isOverstaying(v, now))
    .map((v) => ({
      id: `overstay-${v.id}`,
      kind: 'overstay' as const,
      title: v.visitor?.full_name ?? 'Unknown visitor',
      detail: `Checked in, past expected departure — host ${v.host?.full_name ?? 'not recorded'}`,
      at: v.checked_in_at ?? v.created_at,
    }));
}

/**
 * Every real security alert, most recent first — the KPI tile's "Alerts"
 * count is this list's length, the one-predicate rule again. This is the ONE
 * function in this file that deliberately spans both families: the blacklist
 * half is ranged (it takes whatever window-narrowed `visits` the caller
 * passed) and the overstay half is live (it ignores that narrowing entirely
 * and reads the same `visits` for who is checked in right now). The panel
 * that renders this list must say so on screen — see
 * AdminSecurityAlertsPanel.tsx — because nothing about one row in this array
 * visually distinguishes "happened in your selected window" from "is true at
 * this second" except the `kind` field.
 */
export function securityAlerts(visits: Visit[], now: Date = new Date()): SecurityAlert[] {
  return [...blacklistAlerts(visits), ...overstayAlerts(visits, now)]
    .sort((a, b) => b.at.localeCompare(a.at));
}
