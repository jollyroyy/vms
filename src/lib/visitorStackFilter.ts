// Sort order for the Visitors stacked list.
//
// This file used to also hold `matchesQuery`, a client-side search backing a
// box in the list toolbar. Both are gone: the top bar already carries a global
// search, and the two answered the same question differently — this one could
// only narrow the rows already loaded for the current segment, so a visitor who
// had checked out was findable in one box and not the other. Searching every
// visit in any state lives in lib/searchVisits.ts.
import type { Visit } from '../types/index';

// There is no `recent` / "Latest activity" option (removed 2026-08-13, client
// instruction). It was never a sort — the segment slicer already returns rows
// newest-activity-first, so picking it did nothing but occupy the control with
// a restatement of the order the guard was already looking at. That order is
// still the DEFAULT; it just stopped being something to choose. `null` is how
// a caller says "leave the segment's own order alone".
export type StackSort = 'name' | 'time';

export const SORT_LABELS: Record<StackSort, string> = {
  name: 'Visitor name (A–Z)',
  time: 'Expected time',
};

export const SORT_OPTIONS: StackSort[] = ['name', 'time'];

/** Re-sorts an already-segment-ordered list. `null` is the identity. */
export function sortVisits<T extends Visit>(visits: T[], sort: StackSort | null): T[] {
  if (sort === null) return visits;
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
