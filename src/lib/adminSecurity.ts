import type { Visit, Visitor } from '../types/index';
import { istDateKey, isOverstaying } from './visitExpiry';

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

/**
 * Everyone currently flagged. `visitors` carries no history of the flag being
 * set — no actor, no timestamp of the flagging itself — so this is a filter,
 * not a join. Kept as its own function (rather than inlined at the call site)
 * so the Blacklist panel is guarded even if the query feeding it is ever
 * widened past `is_blacklisted = true`.
 */
export function blacklistedVisitors(visitors: Visitor[]): Visitor[] {
  return visitors.filter((v) => v.is_blacklisted);
}

/** Total flagged visitors — the length of the list above, never a second count. */
export function blacklistedCount(visitors: Visitor[]): number {
  return blacklistedVisitors(visitors).length;
}

/**
 * Visits that ended in a refusal today, whichever desk refused them — an
 * HOD declining a request, or a guard refusing entry at the gate. Both are
 * `status === 'rejected'`; which one happened is on the row's `actor`
 * (lib/visitActors.ts), read in the panel, not decided here. "Today" is
 * `created_at` because a rejection carries no separate decision timestamp on
 * the row itself (the exact instant lives in `audit_logs`, resolved by
 * `attachVisitActors` before this function ever sees the visit).
 */
export function deniedEntriesToday(visits: Visit[], now: Date = new Date()): Visit[] {
  const today = istDateKey(now);
  return visits.filter((v) => v.status === 'rejected' && istDateKey(v.created_at) === today);
}

/** The length of the list above — the KPI tile's number. */
export function deniedEntriesTodayCount(visits: Visit[], now: Date = new Date()): number {
  return deniedEntriesToday(visits, now).length;
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
 * A blacklisted visitor showing up on today's activity is not a routine
 * event — the flag exists precisely so this is noticed, whether they were
 * flagged before or after this visit was raised. Built from REAL rows only:
 * a visit whose joined visitor carries `is_blacklisted`.
 */
function blacklistAlertsToday(visits: Visit[], now: Date = new Date()): SecurityAlert[] {
  const today = istDateKey(now);
  return visits
    .filter((v) => v.visitor?.is_blacklisted && istDateKey(v.created_at) === today)
    .map((v) => ({
      id: `blacklist-${v.id}`,
      kind: 'blacklist' as const,
      title: v.visitor?.full_name ?? 'Unknown visitor',
      detail: v.visitor?.blacklist_reason?.trim() || 'Blacklisted visitor has an active visit today',
      at: v.created_at,
    }));
}

/**
 * Someone still inside, past the deadline `isOverstaying` already uses for
 * the guard and admin dashboards — the same predicate, so this list and
 * those tiles can never disagree about who is overdue.
 */
function overstayAlertsToday(visits: Visit[], now: Date = new Date()): SecurityAlert[] {
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
 * Every real security alert for today, most recent first. The KPI tile's
 * "Alerts Today" count is this list's length — the one-predicate rule again.
 */
export function securityAlertsToday(visits: Visit[], now: Date = new Date()): SecurityAlert[] {
  return [...blacklistAlertsToday(visits, now), ...overstayAlertsToday(visits, now)]
    .sort((a, b) => b.at.localeCompare(a.at));
}
