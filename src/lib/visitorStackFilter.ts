// Sort order for the Visitors stacked list.
//
// This file used to also hold `matchesQuery`, a client-side search backing a
// box in the list toolbar. Both are gone: the top bar already carries a global
// search, and the two answered the same question differently — this one could
// only narrow the rows already loaded for the current segment, so a visitor who
// had checked out was findable in one box and not the other. Searching every
// visit in any state lives in lib/searchVisits.ts.
import type { Visit } from '../types/index';

export type StackSort = 'recent' | 'name' | 'time';

export const SORT_LABELS: Record<StackSort, string> = {
  recent: 'Latest activity',
  name: 'Visitor name (A–Z)',
  time: 'Expected time',
};

export const SORT_OPTIONS: StackSort[] = ['recent', 'name', 'time'];

/** Re-sorts an already-segment-ordered list. `recent` is the identity: the
 *  segment slicer has already ordered by latest activity, so re-sorting there
 *  would be a second, divergent definition of the same word. */
export function sortVisits<T extends Visit>(visits: T[], sort: StackSort): T[] {
  if (sort === 'recent') return visits;
  const copy = [...visits];
  if (sort === 'name') {
    return copy.sort((a, b) =>
      (a.visitor?.full_name ?? '').localeCompare(b.visitor?.full_name ?? '', 'en'));
  }
  // Unscheduled rows sort last rather than to 1970 — a walk-in has no expected
  // time, and floating it to the top of a time-ordered list is noise.
  return copy.sort((a, b) => slot(a) - slot(b));
}

function slot(v: Visit): number {
  if (!v.scheduled_for) return Infinity;
  const t = new Date(v.scheduled_for).getTime();
  return Number.isNaN(t) ? Infinity : t;
}
