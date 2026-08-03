import type { Visit } from '../types/index';

// The guard dashboard's KPI tiles are drill-downs, not links. Clicking a count
// expands the visits behind it *on the same page* — a guard reading the board
// should never lose the board to answer "which five?".
//
// Each key here must stay in lockstep with the matching field on GateStats
// (lib/useGateStats.ts): the tile shows `stats[key]` and the drill-down shows
// `visits.filter(DRILL_FILTER[key])`, so if the two ever disagree the count and
// the card list disagree on screen. The `entered` vs `inside` distinction is the
// one that bites — see the long note in useGateStats.ts. `entered` is derived
// from checked_in_at (cumulative), `inside` from status (live).
export type DrillKey = 'expected' | 'inside' | 'entered' | 'checkedOut' | 'declined';

export const DRILL_KEYS: DrillKey[] = ['expected', 'inside', 'entered', 'checkedOut', 'declined'];

// Same lookup map as useGateStats.IS_EXPECTED, for the same reason: a
// pre-approval is INSERTed already `approved`, a walk-in becomes
// `walkin_approved` once the HOD says yes. No includes() chains (CLAUDE.md).
const IS_EXPECTED: Record<string, boolean> = {
  approved: true,
  walkin_approved: true,
};

export const DRILL_FILTER: Record<DrillKey, (v: Visit) => boolean> = {
  expected: (v) => IS_EXPECTED[v.status] === true,
  inside: (v) => v.status === 'checked_in',
  entered: (v) => v.checked_in_at !== null,
  checkedOut: (v) => v.status === 'checked_out',
  declined: (v) => v.status === 'rejected',
};

export type DrillCopy = { title: string; subtitle: string; empty: string; countLabel: string };

export const DRILL_COPY: Record<DrillKey, DrillCopy> = {
  expected: {
    title: 'Expected today',
    subtitle: 'Approved, not yet at the gate',
    empty: 'Nobody is expected right now.',
    countLabel: 'expected',
  },
  inside: {
    title: 'Inside now',
    subtitle: 'Visitors currently on site',
    empty: 'No one is inside right now.',
    countLabel: 'on site',
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
    subtitle: 'Declined by the host, usually before arrival',
    empty: 'No requests were declined today.',
    countLabel: 'declined',
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
