// The HOD dashboard's KPI board — one entry per tile, and the rule the guard
// board already lives by: A TILE'S COUNT IS THE LENGTH OF THE LIST IT OPENS.
// There is no second rule and no second query. The console loads these five
// lists for its desks anyway; the board slices them, so a number on the
// dashboard and the rows behind it can never describe different sets.
//
// Client instruction, 2026-08-16: every KPI on the HOD dashboard must drill
// down. The four stats used to be counted from a `select id, status` that
// carried no visitor at all — so the number was all there could ever be, and an
// HOD reading "3 awaiting decision" had to go looking for the three.
import type { Visit } from '../types/index';

export type HodTileKey = 'inside' | 'approvedToday' | 'pending' | 'walkins' | 'rejectedToday';

export const HOD_TILE_KEYS: HodTileKey[] = ['inside', 'approvedToday', 'pending', 'walkins', 'rejectedToday'];

export type HodTileMeta = {
  /** The tile's label AND the heading of the list it opens — one string, so the
   *  two cannot disagree about what is in the panel. */
  label: string;
  /** What the number counts, in the HOD's terms. */
  caption: string;
  /** Said when the list is empty. Each tile gets its own: "nobody is on site"
   *  and "nothing is waiting on you" are different facts. */
  empty: string;
  /** Maps onto the `hod-stat--*` modifiers in styles/hod-compact.css. */
  tone?: 'green' | 'amber' | 'red';
  icon: string;
};

export const HOD_TILE_META: Record<HodTileKey, HodTileMeta> = {
  inside: {
    label: 'On-site now', caption: 'Checked in today', icon: '▣',
    empty: 'No visitor from this department is on site.',
  },
  approvedToday: {
    label: 'Approvals today', caption: 'Final decisions cleared', icon: '✓', tone: 'green',
    empty: 'No visit has been approved today.',
  },
  pending: {
    label: 'Awaiting decision', caption: 'Live visit requests', icon: '▧',
    empty: 'No visitor decisions are waiting.',
  },
  walkins: {
    label: 'Walk-ins live', caption: 'Reception arrivals', icon: '⌂', tone: 'amber',
    empty: 'No walk-in requests are waiting at reception.',
  },
  rejectedToday: {
    label: 'Declined today', caption: 'Requests turned down', icon: '⊘', tone: 'red',
    empty: 'Nothing was declined today.',
  },
};

export type HodTileSources = {
  /** Today's visits for this department, full rows. */
  day: Visit[];
  /** Everyone from this department currently checked in (entry stamped today). */
  onSite: Visit[];
  /** Pending walk-ins, unbounded — a request raised at 11pm is still someone
   *  standing at the gate at 12:05am, which is why it is not day-bounded. */
  walkIns: Visit[];
  /** Pending requests that carry a slot. Rare, and legacy: a pre-approval is
   *  created already approved and never passes through `pending_approval`. */
  scheduled: Visit[];
};

/** One slice per tile. The console's own desk lists are reused verbatim where
 *  they exist — the desk and the tile must act on the same rows. */
export function hodTileVisits({ day, onSite, walkIns, scheduled }: HodTileSources): Record<HodTileKey, Visit[]> {
  return {
    inside: onSite,
    approvedToday: day.filter((v) => v.status === 'approved' || v.status === 'walkin_approved'),
    pending: [...scheduled, ...walkIns],
    walkins: walkIns,
    rejectedToday: day.filter((v) => v.status === 'rejected'),
  };
}
