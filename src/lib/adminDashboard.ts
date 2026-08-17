import type { Visit, VisitFeedback, VisitorPurpose } from '../types/index';
import { istDateKey, isOverstaying } from './visitExpiry';
import { visitOrigin } from './visitOrigin';

// Every number on the admin dashboard, derived here and nowhere else.
//
// This is `guardTiles.ts`'s rule applied to a second board: a tile's figure and
// the rows it opens come from ONE predicate, so a count and its drill-down can
// never describe different sets. It is a pure module over an array of visits —
// no queries, no hooks — which is what makes each of these six figures
// assertable in a unit test rather than only visible on screen.
//
// WHAT IS NOT HERE IS AS DELIBERATE AS WHAT IS. There is no "visitors today"
// that counts rows created today: a pre-approval booked three weeks ago and
// walked in this morning is a visitor today, and a request raised this morning
// that nobody answered is not. Arrival is `checked_in_at`, always.

export const PURPOSE_LABELS: Record<VisitorPurpose, string> = {
  meeting: 'Meetings',
  vendor: 'Vendors',
  interview: 'Interviews',
  delivery: 'Deliveries',
  maintenance: 'Maintenance',
  audit: 'Audits',
  other: 'Other',
};

/** Did this visitor come through the gate on the given IST day? */
export function arrivedOn(v: Visit, dayKey: string): boolean {
  return v.checked_in_at !== null && v.checked_in_at !== undefined
    && istDateKey(v.checked_in_at) === dayKey;
}

export type AdminKpis = {
  /** Visitors who came through the gate today. */
  visitorsToday: number;
  // THERE IS NO `visitorsYesterday` / `changeVsYesterday` (client instruction,
  // 2026-08-18: no yesterday comparison on an admin KPI card). They existed to
  // feed one caption, and computing a figure no screen may print is how a
  // "temporary" comparison comes back. The two-day FETCH stays — see
  // AdminDashboard.tsx: it is what puts a visitor who arrived last night and
  // has not left into Currently Inside and into the overstay count.
  /** Live in the facility. The fire-marshal figure: `status === 'checked_in'`,
   *  never widened, never inferred. */
  currentlyInside: number;
  /** Mean measured check-in duration in seconds, and how many arrivals carried
   *  a measurement. `null` where nothing was measured — an average of no
   *  samples is not zero seconds. */
  avgCheckinSeconds: number | null;
  avgCheckinSampleSize: number;
  /** Today's arrivals split by the route they took in. */
  preRegistered: number;
  walkIn: number;
  /** Inside, and past their departure deadline. */
  overstays: number;
  /** Mean rating over the supplied feedback, to one decimal, and its count. */
  satisfaction: number | null;
  reviewCount: number;
};

export function adminKpis(
  visits: Visit[],
  feedback: VisitFeedback[],
  now: Date = new Date(),
): AdminKpis {
  const today = istDateKey(now);

  const arrivalsToday = visits.filter((v) => arrivedOn(v, today));

  const measured = arrivalsToday
    .map((v) => v.checkin_duration_seconds)
    .filter((n): n is number => typeof n === 'number' && n > 0);

  const ratings = feedback.map((f) => f.rating).filter((n) => n >= 1 && n <= 5);

  return {
    visitorsToday: arrivalsToday.length,
    currentlyInside: visits.filter((v) => v.status === 'checked_in').length,
    avgCheckinSeconds: measured.length === 0
      ? null
      : Math.round(measured.reduce((a, b) => a + b, 0) / measured.length),
    avgCheckinSampleSize: measured.length,
    preRegistered: arrivalsToday.filter((v) => visitOrigin(v) === 'pre_approved').length,
    walkIn: arrivalsToday.filter((v) => visitOrigin(v) === 'walk_in').length,
    overstays: visits.filter((v) => v.status === 'checked_in' && isOverstaying(v, now)).length,
    satisfaction: ratings.length === 0
      ? null
      : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
    reviewCount: ratings.length,
  };
}

/**
 * Arrivals per hour for the flow chart.
 *
 * The window is 08:00–18:00 IST, matching the reference screen, and every hour
 * in it is present even at zero — a gap in a line chart reads as missing data,
 * while a point on the axis reads as a quiet hour, and those are different
 * claims. Arrivals outside the window are counted into the nearest end rather
 * than dropped, so the series still sums to the day's total.
 */
export function hourlyFlow(
  visits: Visit[],
  now: Date = new Date(),
  fromHour = 8,
  toHour = 18,
): { label: string; value: number }[] {
  const today = istDateKey(now);
  const buckets = new Map<number, number>();
  for (let h = fromHour; h <= toHour; h += 1) buckets.set(h, 0);

  for (const v of visits) {
    if (!arrivedOn(v, today) || !v.checked_in_at) continue;
    // The IST hour, read by shifting the instant rather than by trusting the
    // browser's zone — this deployment is IST wherever the laptop is.
    const ist = new Date(new Date(v.checked_in_at).getTime() + (5 * 60 + 30) * 60_000);
    const hour = Math.min(toHour, Math.max(fromHour, ist.getUTCHours()));
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([hour, value]) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    value,
  }));
}

/** Today's arrivals split by purpose, largest first, zero-count purposes
 *  dropped — a legend entry reading 0% is a line the reader has to rule out. */
export function purposeSplit(visits: Visit[], now: Date = new Date()): { label: string; value: number }[] {
  const today = istDateKey(now);
  const counts = new Map<VisitorPurpose, number>();
  for (const v of visits) {
    if (!arrivedOn(v, today)) continue;
    counts.set(v.purpose, (counts.get(v.purpose) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([purpose, value]) => ({ label: PURPOSE_LABELS[purpose] ?? purpose, value }));
}

/** Hosts ranked by how many visitors they received today. */
export function topHosts(
  visits: Visit[],
  now: Date = new Date(),
  limit = 5,
): { label: string; value: number; hostId: string; avatarUrl: string | null }[] {
  const today = istDateKey(now);
  const byHost = new Map<string, { name: string; count: number; avatarUrl: string | null }>();

  for (const v of visits) {
    if (!arrivedOn(v, today)) continue;
    const id = v.host_id;
    // A host row that failed to join is named honestly rather than dropped:
    // the visitor did arrive, and losing them from the total to keep the list
    // tidy would make this panel disagree with the Visitors Today tile.
    const name = v.host?.full_name ?? 'Unassigned host';
    const seen = byHost.get(id) ?? { name, count: 0, avatarUrl: v.host?.avatar_url ?? null };
    byHost.set(id, { name: seen.name, count: seen.count + 1, avatarUrl: seen.avatarUrl });
  }

  return [...byHost.entries()]
    .map(([hostId, { name, count, avatarUrl }]) => ({ hostId, label: name, value: count, avatarUrl }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** The lobby feed: everyone who came through today, most recent arrival first. */
export function lobbyFeed(visits: Visit[], now: Date = new Date(), limit = 8): Visit[] {
  const today = istDateKey(now);
  return visits
    .filter((v) => arrivedOn(v, today))
    .sort((a, b) => (b.checked_in_at ?? '').localeCompare(a.checked_in_at ?? ''))
    .slice(0, limit);
}
