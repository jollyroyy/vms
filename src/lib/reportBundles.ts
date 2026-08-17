import type { ReportVisit } from './reportRow';
import { istDateKey, isOverstaying, overstayMs } from './visitExpiry';
import { visitOrigin, visitOriginLabel } from './visitOrigin';
import { PURPOSE_LABELS } from './adminDashboard';
import { visitorsByDay, formatSeconds } from './adminReports';

// The four standing reports the admin Reports screen offers as downloads.
//
// EACH ONE IS DERIVED FROM THE ROWS ALREADY ON SCREEN, never from a second
// query. That is what makes the downloaded file and the register above it the
// same set of visits: a report that re-fetched could be built from a window
// that had moved on since the admin chose the range, and nothing on the page
// would say so. It also means each of these is a pure function of an array —
// so a figure in a downloaded CSV is assertable in a unit test.
//
// They return `Record<string, string>[]`, the shape `exportToCsv` takes, and
// they go through the same discipline `reportRow.ts` established: no nested
// join objects, no base64 photo blob, no raw phone number. A CSV leaves the
// building.

export type ReportBundle = {
  key: string;
  title: string;
  blurb: string;
  /** Filename stem; the range suffix is appended by the caller. */
  filename: string;
  /** `now` is threaded through even though only the overstay report reads it.
   *  Without it that builder closes over `new Date()` and the one figure on
   *  this screen that depends on the current instant — is this visitor past
   *  their departure deadline — becomes untestable through the public
   *  interface. A caller may omit it; each builder defaults. */
  build: (visits: ReportVisit[], from: string, to: string, now?: Date) => Record<string, string>[];
};

function arrivals(visits: ReportVisit[]): ReportVisit[] {
  return visits.filter((v) => Boolean(v.checked_in_at));
}

/** Arrivals per day, plus the split by route in — the monthly summary. */
function monthlySummary(visits: ReportVisit[], from: string, to: string): Record<string, string>[] {
  const days = visitorsByDay(visits, from, to);
  const arrived = arrivals(visits);

  return days.map((d) => {
    const onDay = arrived.filter((v) => istDateKey(v.checked_in_at as string) === d.dateKey);
    const pre = onDay.filter((v) => visitOrigin(v) === 'pre_approved').length;
    return {
      Date: d.dateKey,
      Visitors: String(d.value),
      'Pre-approved': String(pre),
      'Walk-in': String(onDay.length - pre),
      'Still inside': String(onDay.filter((v) => v.status === 'checked_in').length),
    };
  });
}

/** Every host who received a visitor, with their counts. */
function hostActivity(visits: ReportVisit[]): Record<string, string>[] {
  const byHost = new Map<string, { name: string; dept: string; total: number; inside: number }>();

  for (const v of arrivals(visits)) {
    const seen = byHost.get(v.host_id) ?? {
      // Named honestly rather than dropped: the visitor did arrive, and losing
      // them to keep the file tidy would make the totals here disagree with the
      // register the admin exported beside it.
      name: v.host?.full_name ?? 'Unassigned host',
      dept: v.department?.name ?? 'Not recorded',
      total: 0,
      inside: 0,
    };
    byHost.set(v.host_id, {
      ...seen,
      total: seen.total + 1,
      inside: seen.inside + (v.status === 'checked_in' ? 1 : 0),
    });
  }

  return [...byHost.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((h) => ({
      Host: h.name,
      Department: h.dept,
      'Visitors received': String(h.total),
      'Still on site': String(h.inside),
    }));
}

/** Arrivals per IST hour, with the mean time the desk took in each. */
function peakHours(visits: ReportVisit[]): Record<string, string>[] {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
  const buckets = new Map<number, { count: number; timed: number[] }>();

  for (const v of arrivals(visits)) {
    const ist = new Date(new Date(v.checked_in_at as string).getTime() + IST_OFFSET_MS);
    const hour = ist.getUTCHours();
    const seen = buckets.get(hour) ?? { count: 0, timed: [] };
    const secs = v.checkin_duration_seconds;
    buckets.set(hour, {
      count: seen.count + 1,
      timed: typeof secs === 'number' && secs > 0 ? [...seen.timed, secs] : seen.timed,
    });
  }

  // NO ENTRY-POINT ROWS TRAIL THIS FILE ANY MORE (removed 2026-08-17, client
  // instruction, with the Entry Point Utilization panel). Nothing writes
  // `visits.entry_point_id`, so every one of those trailing rows read
  // "Entry point — not recorded", which in a CSV is worse than on screen: a
  // sheet where one column silently changes meaning halfway down is a sheet
  // somebody will pivot by mistake.
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, { count, timed }]) => ({
      // No zone suffix. This deployment is IST end to end — every stamp on
      // every screen and in every file is already IST — so naming it on one
      // column of one report implies the others might be something else.
      Hour: `${String(hour).padStart(2, '0')}:00`,
      Arrivals: String(count),
      // "Not measured", never "0s": nothing was timed in that hour, which is a
      // different claim from the desk having been instant.
      'Avg check-in time': timed.length === 0
        ? 'Not measured'
        : formatSeconds(Math.round(timed.reduce((a, b) => a + b, 0) / timed.length)),
    }));
}

/** Missed appointments, lapsed approvals and visits that ran past their
 *  deadline — the three ways a visit ends badly, in one file. */
export function noShowOverstay(visits: ReportVisit[], now = new Date()): Record<string, string>[] {
  const rows: Record<string, string>[] = [];

  for (const v of visits) {
    // The three closed-without-arriving outcomes are separate statuses on
    // purpose (migrations 065/066/081) and must not be merged here: a missed
    // appointment, an unused approval and a request nobody answered are
    // different failures with different people to chase.
    const outcome = v.status === 'no_show' ? 'No-show — booked slot missed'
      : v.status === 'expired' ? 'Expired — approval lapsed unused'
      : v.status === 'lapsed' ? 'Lapsed — nobody ever decided'
      : v.status === 'checked_in' && isOverstaying(v, now) ? 'Overstaying — past departure deadline'
      : null;
    if (!outcome) continue;

    rows.push({
      Reference: v.ref_number,
      Visitor: v.visitor?.full_name ?? 'Unknown',
      'Type of Visitor': visitOriginLabel(visitOrigin(v)),
      Purpose: PURPOSE_LABELS[v.purpose] ?? v.purpose,
      Host: v.host?.full_name ?? 'Not recorded',
      Department: v.department?.name ?? 'Not recorded',
      Scheduled: v.scheduled_for ? new Date(v.scheduled_for).toLocaleString('en-IN') : 'NA',
      Outcome: outcome,
      'Overstaying by': v.status === 'checked_in'
        ? formatSeconds(Math.round(overstayMs(v, now) / 1000))
        : '',
    });
  }

  return rows;
}

export const REPORT_BUNDLES: ReportBundle[] = [
  {
    key: 'monthly',
    title: 'Monthly Visitor Summary',
    blurb: 'Arrivals per day, split by pre-approved and walk-in.',
    filename: 'visitor-summary',
    build: monthlySummary,
  },
  {
    key: 'hosts',
    title: 'Host Activity Report',
    blurb: 'Who received visitors, and how many are still on site.',
    filename: 'host-activity',
    build: (visits) => hostActivity(visits),
  },
  {
    key: 'peak',
    title: 'Peak Hours Analysis',
    blurb: 'Arrivals by hour, with the mean time the desk took in each.',
    filename: 'peak-hours',
    build: (visits) => peakHours(visits),
  },
  {
    key: 'noshow',
    title: 'No-show & Overstay Report',
    blurb: 'Missed bookings, lapsed approvals and visits past their deadline.',
    filename: 'no-show-overstay',
    build: (visits, _from, _to, now) => noShowOverstay(visits, now),
  },
];
