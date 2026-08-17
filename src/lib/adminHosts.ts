import type { Department, Profile, Visit } from '../types/index';
import { istDateKey } from './visitExpiry';

// Every number on the admin Hosts tab, derived here and nowhere else — the
// same rule `adminDashboard.ts` follows: a pure module over the visits array
// already fetched by `useAdminVisits`, so the KPI tiles, the directory and the
// department panel can never disagree about who counts as a host or what
// "this week" means. No hooks, no queries — every figure here is assertable
// in a unit test without touching Supabase.
//
// A "HOST" IS NOT "AN HOD". `useHods()` lists profiles with `role === 'hod'`,
// but `visits.host_id` can name any profile a walk-in or pre-approval was
// raised against — the "person to meet" list is department-scoped, not
// role-scoped (see `get_hosts_for_department`). Counting only HODs would
// under-report the moment a single walk-in named a staff member as the host,
// so every function here unions the HOD list with whatever host ids actually
// appear on the fetched visits.

const WEEK_DAYS = 7;

/** The `WEEK_DAYS` most recent IST calendar days, today included. */
function lastWeekDayKeys(now: Date): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < WEEK_DAYS; i += 1) {
    keys.add(istDateKey(new Date(now.getTime() - i * 86_400_000)));
  }
  return keys;
}

/** Did this visitor arrive (were checked in) within the last 7 IST days? */
export function arrivedThisWeek(v: Visit, now: Date = new Date()): boolean {
  if (!v.checked_in_at) return false;
  return lastWeekDayKeys(now).has(istDateKey(v.checked_in_at));
}

/** This week's arrivals, out of whatever window the caller fetched. Filtering
 *  again here (rather than trusting the fetch) is what keeps this correct
 *  even though `useAdminVisits`'s OR clause can hand back a row created in
 *  the window but checked in outside it, or vice versa. */
export function weekArrivals(visits: Visit[], now: Date = new Date()): Visit[] {
  return visits.filter((v) => arrivedThisWeek(v, now));
}

/** Every profile id that is a host in this window: every HOD, plus every
 *  `host_id` actually written onto a visit. Order is not meaningful here —
 *  callers that need a stable order derive it themselves. */
export function distinctHostIds(hods: Profile[], visits: Visit[]): string[] {
  const ids = new Set<string>();
  for (const h of hods) ids.add(h.id);
  for (const v of visits) if (v.host_id) ids.add(v.host_id);
  return [...ids];
}

export type AdminHostKpis = {
  totalHosts: number;
  visitorsThisWeek: number;
  /** Already formatted to one decimal, e.g. "3.4" — or the words "No hosts"
   *  when `totalHosts` is zero, never "0.0" or "NaN". A ratio with an empty
   *  denominator is not a number the system can stand behind. */
  avgPerHost: string;
};

export function hostKpis(
  hods: Profile[],
  visits: Visit[],
  now: Date = new Date(),
): AdminHostKpis {
  const totalHosts = distinctHostIds(hods, visits).length;
  const visitorsThisWeek = weekArrivals(visits, now).length;
  return {
    totalHosts,
    visitorsThisWeek,
    avgPerHost: totalHosts === 0 ? 'No hosts' : (visitorsThisWeek / totalHosts).toFixed(1),
  };
}

export type HostSummary = {
  hostId: string;
  name: string;
  departmentName: string;
  visitsThisWeek: number;
};

/**
 * Every host ranked by this week's arrivals, most first.
 *
 * A host's name and department come from `useHods()`/`useDepartments()` when
 * they are one — the live, realtime-scoped truth — and fall back to whatever
 * the visit row itself joined (`v.host`, `v.department`) for a host who is
 * not an HOD. A host neither list can name at all reads "Not recorded",
 * never a blank cell or an invented one.
 */
export function hostDirectory(
  hods: Profile[],
  departments: Department[],
  visits: Visit[],
  now: Date = new Date(),
): HostSummary[] {
  const week = weekArrivals(visits, now);
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

  const nameById = new Map<string, string>();
  const deptOf = new Map<string, string>();
  for (const h of hods) {
    nameById.set(h.id, h.full_name);
    deptOf.set(h.id, h.department_id ? (deptNameById.get(h.department_id) ?? 'Not recorded') : 'Not recorded');
  }
  // A host who is not an HOD has no entry above yet — fill it from whichever
  // visit named them, which is the only place their name and department are
  // known at all.
  for (const v of visits) {
    if (!v.host_id) continue;
    if (!nameById.has(v.host_id)) nameById.set(v.host_id, v.host?.full_name ?? 'Not recorded');
    if (!deptOf.has(v.host_id)) deptOf.set(v.host_id, v.department?.name ?? 'Not recorded');
  }

  const countByHost = new Map<string, number>();
  for (const v of week) countByHost.set(v.host_id, (countByHost.get(v.host_id) ?? 0) + 1);

  return distinctHostIds(hods, visits)
    .map((hostId) => ({
      hostId,
      name: nameById.get(hostId) ?? 'Not recorded',
      departmentName: deptOf.get(hostId) ?? 'Not recorded',
      visitsThisWeek: countByHost.get(hostId) ?? 0,
    }))
    .sort((a, b) => b.visitsThisWeek - a.visitsThisWeek || a.name.localeCompare(b.name));
}

/** This week's arrivals grouped by department name, largest first — feeds the
 *  Department Summary panel's `UtilizationRows`. A visit whose department
 *  join failed to resolve is counted under "Not recorded" rather than
 *  dropped, so the panel's total never falls short of the KPI tile above it. */
export function departmentSummary(
  visits: Visit[],
  now: Date = new Date(),
): { label: string; value: number }[] {
  const week = weekArrivals(visits, now);
  const counts = new Map<string, number>();
  for (const v of week) {
    const name = v.department?.name ?? 'Not recorded';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
