import type { VisitStatus } from '../types/index';
import type { ReportVisit } from './reportRow';
import { visitOrigin, type VisitOrigin } from './visitOrigin';

// The Visitors Log's filtering, as pure functions.
//
// The log is the admin's REGISTER: every visit, in any state, newest first. It
// is deliberately not the same surface as Reports — Reports is a date-bounded
// document that prints and exports with seventeen pinned columns, while this is
// a running list you search when somebody asks "did a Mr Mehta come in last
// week". A date range answers the first question; a search box answers the
// second, and giving each surface only the control that fits it is what keeps
// them from becoming two half-versions of one screen.

export type LogFilters = {
  /** Free text over name, vendor, phone and reference number. */
  query: string;
  status: VisitStatus | 'all';
  origin: VisitOrigin | 'all';
};

export const DEFAULT_LOG_FILTERS: LogFilters = { query: '', status: 'all', origin: 'all' };

/**
 * Does this visit match the typed query?
 *
 * Matched fields are the four a person actually knows about a visitor: their
 * name, who they came from, their number, and the reference on their pass.
 * Digits-only comparison for the phone, because a guard writes 98765 43210 and
 * an admin searches 9876543210 — the same rule `checkInMatches.ts` already
 * follows, and the two must not disagree about whether a number matches.
 */
export function matchesLogQuery(v: ReportVisit, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;

  const digits = q.replace(/\D/g, '');
  const phone = (v.visitor?.phone ?? '').replace(/\D/g, '');

  return (
    (v.visitor?.full_name ?? '').toLowerCase().includes(q)
    || (v.visitor?.vendor_name ?? '').toLowerCase().includes(q)
    || (v.ref_number ?? '').toLowerCase().includes(q)
    // A one- or two-digit query would match almost every phone number, which
    // is noise rather than a result. Three is the shortest fragment somebody
    // types on purpose.
    || (digits.length >= 3 && phone.includes(digits))
  );
}

export function filterLog(visits: ReportVisit[], filters: LogFilters): ReportVisit[] {
  return visits.filter((v) => {
    if (filters.status !== 'all' && v.status !== filters.status) return false;
    if (filters.origin !== 'all' && visitOrigin(v) !== filters.origin) return false;
    return matchesLogQuery(v, filters.query);
  });
}

/** Statuses actually present in the loaded rows, so the picker can never offer
 *  one that opens an empty table. */
export function statusesPresent(visits: ReportVisit[]): VisitStatus[] {
  return [...new Set(visits.map((v) => v.status))].sort();
}
