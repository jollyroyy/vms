import type { Visit } from '../types/index';
import { isOverstaying } from './visitExpiry';

// The guard dashboard's KPI tiles are drill-downs, not links. Clicking a count
// expands the visits behind it *on the same page* — a guard reading the board
// should never lose the board to answer "which ones?".
//
// Each key here must stay in lockstep with the matching field on GateStats
// (lib/useGateStats.ts): the tile shows `stats[key]` and the drill-down shows
// `visits.filter(DRILL_FILTER[key])`, so if the two ever disagree the count and
// the card list disagree on screen. The `entered` vs `inside` distinction is the
// one that bites — see the long note in useGateStats.ts. `entered` is derived
// from checked_in_at (cumulative), `inside` from status (live).
//
// `preApproved` and `walkInApproved` are deliberately NOT here (2026-08-13).
// Both populations are already first-class segments of the Visitors surface
// (`/visitors/expected` and `/visitors/approved`), each with its own KPI tile
// on that page's rail and its own list underneath. Carrying them a second time
// on the dashboard put the same two counts on two screens with two independent
// queries behind them — the duplicate-render rule, and the exact failure mode
// the derived Recent Activity feed was rebuilt to avoid. The dashboard keeps
// what only it answers: the day's traffic, and the work still owed attention.
export type DrillKey = 'inside' | 'overstaying' | 'entered' | 'checkedOut' | 'declined' | 'noShow';

// Grid order, and it is the gate's own order. The first row is the traffic
// through the door — what came in, what went out, who is therefore still here —
// and the second is the four things still owed someone's attention. Reading it
// left to right answers "how did today go?" before "what do I need to do?".
//
// `overstaying` opens the second row rather than sitting beside `inside`, even
// though it is a subset of it: it belongs with the work queue, because unlike
// Inside Now it is a number the guard is expected to act on.
export const DRILL_KEYS: DrillKey[] = ['entered', 'checkedOut', 'inside', 'overstaying', 'noShow', 'declined'];

export const DRILL_FILTER: Record<DrillKey, (v: Visit) => boolean> = {
  inside: (v) => v.status === 'checked_in',
  overstaying: (v) => isOverstaying(v),
  entered: (v) => v.checked_in_at !== null,
  checkedOut: (v) => v.status === 'checked_out',
  declined: (v) => v.status === 'rejected',
  noShow: (v) => v.status === 'no_show',
};

export type DrillCopy = { title: string; subtitle: string; empty: string; countLabel: string };

export const DRILL_COPY: Record<DrillKey, DrillCopy> = {
  inside: {
    title: 'Inside now',
    subtitle: 'Visitors currently on site',
    empty: 'No one is inside right now.',
    countLabel: 'on site',
  },
  overstaying: {
    title: 'Overstaying',
    subtitle: 'Still showing as inside long after they arrived — check them out if they have gone',
    empty: 'Nobody has been inside unusually long.',
    countLabel: 'overstaying',
  },
  entered: {
    title: 'Entered today',
    subtitle: 'Everyone who came through the gate',
    empty: 'Nobody has come through the gate yet.',
    countLabel: 'entered',
  },
  checkedOut: {
    title: 'Checked out',
    subtitle: 'Came and left',
    empty: 'Nobody has checked out yet.',
    countLabel: 'checked out',
  },
  declined: {
    // NOT "Denied entry" — `rejected` means an HOD declined the request, usually
    // before the visitor ever reached the gate. See DashboardSummary.
    title: 'Declined requests',
    subtitle: 'Declined by the person to meet, usually before arrival',
    empty: 'No requests were declined today.',
    countLabel: 'declined',
  },
  noShow: {
    title: 'No shows',
    subtitle: 'Booked, never arrived',
    empty: 'Nobody was marked a no-show.',
    countLabel: 'no-shows',
  },
};

/** The visits behind a tile, newest activity first. */
export function drillVisits<T extends Visit>(visits: T[], key: DrillKey): T[] {
  const filtered = visits.filter(DRILL_FILTER[key]);
  return filtered.sort((a, b) => stamp(b) - stamp(a));
}

/** Sort key: the most recent thing that happened to this visit today. */
function stamp(v: Visit): number {
  const iso = v.checked_out_at ?? v.checked_in_at ?? v.created_at;
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}
