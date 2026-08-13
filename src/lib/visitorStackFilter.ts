// Client-side narrowing for the Visitors list toolbar.
//
// Deliberately NOT a server search. The Visitors page has already loaded the
// rows it lists, so typing filters what is on screen — instant, and it can
// never contradict the count beside the heading. Finding a pass that is NOT in
// that window (used, rejected, swept closed) is a different question with a
// different answer: lib/searchVisits.ts, reached from Scan Pass and /search.
import type { Visit } from '../types/index';

/** Digits only, so a guard can type a phone with or without spaces or +91. */
function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Drops an Indian country code the way lib/blacklist.normalizePhone does.
 *  `visitors.phone` is STORED normalized to ten digits, so a guard typing
 *  `+919876543210` was asking whether a 10-digit haystack contains a 12-digit
 *  needle — impossible, and it silently returned no match while the bare
 *  number worked. Any comparison against that column has to normalize first. */
function normalizeQueryDigits(d: string): string {
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
}

/** Matches name, vendor, phone or reference number. Case-insensitive. */
export function matchesQuery(v: Visit, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const qDigits = normalizeQueryDigits(digits(q));
  // A query that is only digits is a phone number, not a name — comparing it
  // digits-only lets "98765 43210", "9876543210" and "+919876543210" all find
  // the same visitor. Guarded on length so a single stray digit typed into the
  // box does not match every phone in the list.
  if (qDigits.length >= 3 && qDigits.length === q.replace(/[\s+()-]/g, '').length) {
    if (digits(v.visitor?.phone ?? '').includes(qDigits)) return true;
  }

  const haystack = [
    v.visitor?.full_name,
    v.visitor?.vendor_name,
    v.ref_number,
    v.host?.full_name,
    v.department?.name,
    v.purpose,
  ];
  return haystack.some((f) => (f ?? '').toLowerCase().includes(q));
}

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
