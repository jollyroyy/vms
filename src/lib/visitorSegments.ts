// The Visitors surface, defined once.
//
// `/visitors` used to be a single page with a three-tab bar hidden inside it,
// so the sidebar said "Walk-in Visitors" and gave no hint that Inside, Pending
// and the rest existed at all. The nav now expands into these segments and each
// one is a real URL, which means a guard can bookmark "Inside", the browser
// back button works between them, and the sidebar can show a live count beside
// each label.
//
// This file is the single source of truth for that list. The sidebar reads it
// (components/layout/navLinks.tsx), the page reads it (pages/Guard/Console.tsx)
// and the count hook reads it (lib/useVisitorCounts.ts) — so a segment can
// never exist in the nav without existing on the page, or be counted by a rule
// different from the one that lists it. Adding a segment is one edit here.
import type { Visit } from '../types/index';

export type VisitorSegment =
  | 'all'
  | 'inside'
  | 'pending'
  | 'walkinApproved'
  | 'walkin';

/** Nav order. Deliberately the order of a visitor's life at the gate:
 *  arrived → waiting on a decision → approved. "All Visitors" leads because it
 *  is the segment's own landing page, and the walk-in register trails because
 *  it is a form, not a list.
 *
 *  There is NO `expected` segment either (removed 2026-08-15, client
 *  instruction), for the same reason `checkedOut` went: a visitor booked for
 *  today who has not arrived is the **Pre-Registered** tab's whole subject, and
 *  that board can act on them (it starts the check-in) where this display-only
 *  surface could not. `/visitors/expected` and the legacy `?tab=checkin` both
 *  degrade onto `all`, which still contains those rows.
 *
 *  There is NO `checkedOut` segment (removed 2026-08-15, client instruction).
 *  A visitor who has left is the **Entry & Exit** tab's subject — that page
 *  holds their entry time, their exit time and their pass, side by side with
 *  the people still inside. Listing them here as well put one visitor on two
 *  surfaces with nothing saying which was authoritative. `/visitors/checked-out`
 *  degrades onto `all`, which still contains today's departures.
 *
 *  There is NO `overstayed` segment (removed 2026-08-13, client instruction).
 *  An overstay is not a stage of a visitor's life here — it is a subset of
 *  Inside that needs chasing, and the guard dashboard's Overstaying tile is
 *  where that chasing happens. `isOverstaying` is still live for that tile and
 *  must not be deleted. */
export const VISITOR_SEGMENTS: VisitorSegment[] = [
  'all', 'inside', 'pending', 'walkinApproved', 'walkin',
];

/** URL slug. `all` is the bare `/visitors` route, so it has no slug. */
export const SEGMENT_SLUG: Record<VisitorSegment, string> = {
  all: '',
  inside: 'inside',
  pending: 'pending',
  walkinApproved: 'approved',
  walkin: 'walk-in',
};

export function segmentPath(segment: VisitorSegment): string {
  const slug = SEGMENT_SLUG[segment];
  return slug ? `/visitors/${slug}` : '/visitors';
}

// Slug → segment, plus every legacy `?tab=` value the old console understood.
// Those links live in bookmarks and in old dashboard tiles; none of them may
// 404 into a blank page. A lookup map, never an includes() chain (CLAUDE.md).
const SLUG_TO_SEGMENT: Record<string, VisitorSegment> = {
  inside: 'inside',
  pending: 'pending',
  approved: 'walkinApproved',
  // The Overstayed segment is gone; its URL degrades onto Inside rather than
  // 404-ing, because that is the list an old bookmark was really reaching for.
  overstayed: 'inside',
  // Both the Checked Out and Expected segments are gone; their URLs degrade
  // onto All rather than 404-ing. All still contains today's departures, and
  // still contains today's approved arrivals. The dedicated views are the
  // Entry & Exit tab and the Pre-Registered tab respectively.
  'checked-out': 'all',
  expected: 'all',
  'walk-in': 'walkin',
  // Legacy aliases from the tab-bar era.
  walkins: 'walkin',
  'walkin-approved': 'walkinApproved',
  checkin: 'all',
  exit: 'inside',
  rejected: 'all',
  all: 'all',
  'no-show': 'all',
};

/** Resolves a URL slug (or a legacy ?tab= value) to a segment. Unknown input
 *  degrades onto `all` rather than rendering nothing. */
export function segmentFromSlug(slug: string | undefined | null): VisitorSegment {
  if (!slug) return 'all';
  return SLUG_TO_SEGMENT[slug] ?? 'all';
}

export type SegmentMeta = {
  /** Sidebar label. */
  navLabel: string;
  /** Page heading. */
  title: string;
  subtitle: string;
  empty: string;
  emptyHint: string;
  /** False for segments whose count is not a number a guard acts on. */
  showCount: boolean;
};

export const SEGMENT_META: Record<VisitorSegment, SegmentMeta> = {
  all: {
    navLabel: 'All Visitors',
    title: 'All Visitors',
    subtitle: 'Everyone at the gate today, plus anything still open',
    empty: 'No visitor activity yet.',
    emptyHint: 'Arrivals, walk-ins and departures all appear here.',
    showCount: false,
  },
  inside: {
    navLabel: 'Inside',
    title: 'Inside',
    subtitle: 'Currently on the premises — check them out when they leave',
    empty: 'No one is inside right now.',
    emptyHint: 'Visitors you check in will appear here until they leave.',
    showCount: true,
  },
  pending: {
    navLabel: 'Pending Approval',
    title: 'Pending Approval',
    subtitle: 'Walk-ins waiting on a decision from the person to meet',
    empty: 'Nothing waiting on a person to meet.',
    emptyHint: 'Walk-ins you register appear here until the host responds.',
    showCount: true,
  },
  walkinApproved: {
    navLabel: 'Approved Walk-ins',
    title: 'Approved Walk-ins',
    subtitle: 'The host said yes — capture a photo and let them in',
    empty: 'No approved walk-ins waiting.',
    emptyHint: 'Once a host approves a walk-in, it appears here to be checked in.',
    showCount: true,
  },
  walkin: {
    navLabel: 'Walk-in Register',
    title: 'Walk-in Visitors',
    subtitle: 'Register an unannounced arrival and send the host an approval request',
    empty: 'Nothing waiting on a person to meet.',
    emptyHint: 'Walk-ins you register will appear here until the person to meet responds.',
    showCount: false,
  },
};

// Which rows each segment lists. `walkin` is absent on purpose — it is a
// registration form with its own pending list (pages/Guard/GuardWalkIns.tsx),
// not a slice of the loaded visits.
export type ListSegment = Exclude<VisitorSegment, 'walkin'>;

export const SEGMENT_FILTER: Record<ListSegment, (v: Visit) => boolean> = {
  all: () => true,
  // Due TODAY, not merely approved. The load window is deliberately unbounded
  // for open statuses (a booking made three weeks ago for today must appear),
  // which also drags in next month's bookings — and a future booking read as
  // an arrival due now is exactly the mistake this list must not invite.
  inside: (v) => v.status === 'checked_in',
  pending: (v) => v.status === 'pending_approval',
  walkinApproved: (v) => v.status === 'walkin_approved',
};

/** The rows behind a segment, most recent activity first. */
export function segmentVisits<T extends Visit>(visits: T[], segment: ListSegment): T[] {
  return visits.filter(SEGMENT_FILTER[segment]).sort((a, b) => stamp(b) - stamp(a));
}

function stamp(v: Visit): number {
  const iso = v.checked_out_at ?? v.checked_in_at ?? v.scheduled_for ?? v.created_at;
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

// The statuses that are never date-bounded when loading. An unfinished visit
// must not vanish at midnight: a walk-in registered at 23:50 and approved at
// 00:05, a visitor still inside from last night, and a pre-approval booked last
// week for today are all rows a guard still has to act on. `approved` joined
// this list when Expected became a segment — without it, the ordinary case
// (booked yesterday, arriving today) never loaded at all.
export const OPEN_STATUSES = ['pending_approval', 'approved', 'walkin_approved', 'checked_in'] as const;

/** The PostgREST `.or()` filter for the Visitors surface: today's rows, plus
 *  everything still open whatever day it was raised on. Shared by the page and
 *  the sidebar count hook so the count and the list can never disagree. */
export function visitorLoadFilter(today: string): string {
  return `created_at.gte.${today}T00:00:00Z,status.in.(${OPEN_STATUSES.join(',')})`;
}
