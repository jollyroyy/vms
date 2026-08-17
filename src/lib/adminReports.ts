import type { Visit } from '../types/index';
import { istDateKey } from './visitExpiry';

// The Reports screen's three charts and its utilization list, derived here.
//
// Same contract as `adminDashboard.ts`: pure functions over an array of visits,
// so a figure on a chart can be asserted in a test. The two files are separate
// because the questions are — the dashboard asks "what is happening now" over
// today, Reports asks "what happened" over a chosen range, and merging them
// would put a `now`-dependent default into functions whose whole point is that
// the window is chosen by the reader.

/** Every IST date key from `from` to `to` inclusive, so a day with no visitors
 *  still appears on the axis. A missing bar and a zero bar are different
 *  claims: one says nobody came, the other says we did not look. */
export function dateKeysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00+05:30`).getTime();
  const end = new Date(`${to}T00:00:00+05:30`).getTime();
  for (let t = start; t <= end; t += 86400000) {
    out.push(istDateKey(new Date(t)));
  }
  return out;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short axis label for a date key. A range of a week or less reads best as
 *  weekday names (the reference screen's Mon–Sun); anything longer needs the
 *  date, because "Mon" repeats. */
export function axisLabelFor(dateKey: string, dayCount: number): string {
  const d = new Date(`${dateKey}T00:00:00+05:30`);
  if (dayCount <= 7) return WEEKDAY[d.getUTCDay()] ?? dateKey.slice(5);
  return dateKey.slice(5); // MM-DD
}

/** Arrivals per day across the range. */
export function visitorsByDay(
  visits: Visit[],
  from: string,
  to: string,
): { label: string; value: number; dateKey: string }[] {
  const keys = dateKeysInRange(from, to);
  const counts = new Map(keys.map((k) => [k, 0]));

  for (const v of visits) {
    if (!v.checked_in_at) continue;
    const key = istDateKey(v.checked_in_at);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return keys.map((dateKey) => ({
    dateKey,
    label: axisLabelFor(dateKey, keys.length),
    value: counts.get(dateKey) ?? 0,
  }));
}

/**
 * Mean check-in duration per day, in seconds.
 *
 * A DAY WITH NO MEASURED CHECK-IN IS DROPPED, not plotted as zero. Zero seconds
 * is a claim that the desk processed visitors instantly; the honest reading is
 * that nothing was timed, and a line chart cannot say "unmeasured" at a point.
 * Every visit recorded before migration 088 carries a null duration, so on a
 * range that reaches back before it this series is legitimately short — the
 * card says how many days it covers.
 */
export function checkinTimeTrend(
  visits: Visit[],
  from: string,
  to: string,
): { label: string; value: number; dateKey: string }[] {
  const keys = dateKeysInRange(from, to);
  const sums = new Map<string, { total: number; n: number }>();

  for (const v of visits) {
    const secs = v.checkin_duration_seconds;
    if (!v.checked_in_at || typeof secs !== 'number' || secs <= 0) continue;
    const key = istDateKey(v.checked_in_at);
    const seen = sums.get(key) ?? { total: 0, n: 0 };
    sums.set(key, { total: seen.total + secs, n: seen.n + 1 });
  }

  return keys
    .filter((k) => sums.has(k))
    .map((dateKey) => {
      const { total, n } = sums.get(dateKey) as { total: number; n: number };
      return { dateKey, label: axisLabelFor(dateKey, keys.length), value: Math.round(total / n) };
    });
}

export type EntryPointUsage = { label: string; value: number };

/**
 * Arrivals per entry point across the range.
 *
 * Visits with no entry point recorded are NOT dropped and NOT folded into a
 * gate — they are returned separately as `unrecorded`, so the panel can say how
 * much of the picture it is missing. Every visit made before migration 084
 * falls in that bucket, and quietly attributing them to Reception A would put a
 * fabricated location on a record someone may later be asked to account for.
 */
export function entryPointUsage(visits: Visit[]): { rows: EntryPointUsage[]; unrecorded: number } {
  const counts = new Map<string, number>();
  let unrecorded = 0;

  for (const v of visits) {
    if (!v.checked_in_at) continue;
    const name = v.entry_point?.name;
    if (!name) { unrecorded += 1; continue; }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const rows = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  return { rows, unrecorded };
}

/** Human reading of a duration in seconds — "38s", "2m 05s". The tile and the
 *  axis share it, so the number under the chart and the number on the card
 *  cannot be formatted two ways. */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${mins}m ${String(rest).padStart(2, '0')}s`;
}

/** The default Reports window: the IST week ending today. */
export function defaultReportRange(now: Date = new Date()): { from: string; to: string } {
  const to = istDateKey(now);
  const from = istDateKey(new Date(now.getTime() - 6 * 86400000));
  return { from, to };
}
