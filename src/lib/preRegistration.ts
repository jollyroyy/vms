import type { Visit } from '../types/index';
import type { ReportVisit } from './reportRow';
import { visitOrigin } from './visitOrigin';
import { istDateKey } from './visitExpiry';

// The admin Pre-Registration tab's filter shape and its two pure data steps,
// kept out of the page component (and out of any .tsx file) so this stays a
// plain lib module the project's `tsc --noEmit` lint config can check without
// a JSX parser — that config only includes `src/lib/**/*.ts`.

export type DateRangeFilter = 'all' | 'today' | 'next7' | 'past';

export type PreRegFilters = {
  host: string; // 'all', or a host's full_name
  dateRange: DateRangeFilter;
  status: string; // 'all', or a VisitStatus
};

export const DEFAULT_FILTERS: PreRegFilters = { host: 'all', dateRange: 'all', status: 'all' };

/**
 * Narrows the admin's recent-visits window to PRE-REGISTRATIONS: a visitor
 * booked in advance. `scheduled_for` is the strongest signal (only a
 * pre-approval ever carries one), and the three closed statuses are folded in
 * because a pre-approval that lapsed unused can still have lost its
 * `scheduled_for` on old rows written before `validatePreApproval` made the
 * slot mandatory (see lib/visitOrigin.ts's documented gap) — without this
 * clause those rows would silently vanish from the one tab whose job is
 * showing them. `no_show` and `expired` are included for the same reason
 * `expired` already spans both routes: a booking that lapsed is still a
 * booking. Walk-ins never carry `scheduled_for` and never reach `approved`,
 * so they are excluded by construction, not by a second check here.
 */
export function isPreRegistration(v: Pick<Visit, 'scheduled_for' | 'status'>): boolean {
  return v.scheduled_for !== null || v.status === 'approved' || v.status === 'no_show' || v.status === 'expired';
}

function matchesDateRange(v: Pick<Visit, 'scheduled_for'>, range: PreRegFilters['dateRange'], now: Date): boolean {
  if (range === 'all') return true;
  // No slot on record: cannot be "today", "next 7 days" or "past" — only "all"
  // can honestly include it, so every other filter excludes it rather than
  // guessing which bucket it belongs in.
  if (!v.scheduled_for) return false;
  const slot = new Date(v.scheduled_for);
  if (range === 'today') return istDateKey(slot) === istDateKey(now);
  if (range === 'past') return slot.getTime() < now.getTime();
  // next7: from this instant through the end of the 7th day out, inclusive —
  // matching what a person reading "next 7 days" on a booking board expects,
  // not a bare 168-hour window that could exclude a booking made for later
  // today.
  const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
  return slot.getTime() >= now.getTime() && istDateKey(slot) <= istDateKey(sevenDaysOut);
}

/** Client-side filter over the already-loaded pre-registration rows. */
export function filterPreRegistrations(
  rows: ReportVisit[],
  filters: PreRegFilters,
  now: Date = new Date(),
): ReportVisit[] {
  return rows.filter((v) => {
    if (filters.host !== 'all' && v.host?.full_name !== filters.host) return false;
    if (filters.status !== 'all' && v.status !== filters.status) return false;
    if (!matchesDateRange(v, filters.dateRange, now)) return false;
    return true;
  });
}

export type PreRegKpis = {
  invitesSent: number;
  confirmed: number;
  noShows: number;
};

/**
 * The three KPI counts, over the SAME pre-registration rows the table lists
 * before any filter bar narrowing — a KPI that moved when the Host dropdown
 * changed would stop answering "how many invites went out" and start
 * answering "how many for this one host", which is not what a summary card
 * is for.
 */
export function preRegKpis(rows: ReportVisit[]): PreRegKpis {
  let invitesSent = 0;
  let confirmed = 0;
  let noShows = 0;
  for (const v of rows) {
    if (v.invitation_sent_at) invitesSent += 1;
    if ((v.status === 'checked_in' || v.status === 'checked_out') && visitOrigin(v) === 'pre_approved') confirmed += 1;
    if (v.status === 'no_show') noShows += 1;
  }
  return { invitesSent, confirmed, noShows };
}
