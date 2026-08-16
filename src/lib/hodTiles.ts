// The HOD dashboard's KPI board — one entry per tile, and the rule the guard
// board already lives by: A TILE'S COUNT IS THE LENGTH OF THE LIST IT OPENS.
// There is no second rule and no second query. The console loads these lists
// for its desks anyway; the board slices them, so a number on the dashboard and
// the rows behind it can never describe different sets.
//
// Client instruction, 2026-08-16: the HOD view must look and read EXACTLY like
// the guard's — same tiles, same table, same type. So the ring classes and the
// glyphs come from the shared sets (lib/tileIcons.ts, the same brand/success/
// warning/danger meanings the guard board assigns), and each tile's panel is a
// DashboardPanelSpec composed from the shared COLUMN atoms. Nothing here draws
// a cell of its own.
//
// THERE IS NO SEPARATE "WALK-INS LIVE" TILE (removed 2026-08-16 with the
// Approval Desk). Every `pending_approval` row is a walk-in — WalkInRequest and
// the kiosk are the only two writers of that status and both insert
// `scheduled_for: null`, while a pre-approval is created already approved — so
// once the scheduled-decision desk went, "Awaiting decision" and "Walk-ins
// live" were two tiles opening one identical list. That is the no-duplicate-
// renders rule: the same value twice on one screen makes the eye check whether
// the two agree.
import type { Visit } from '../types/index';
import { COLUMN, type DashboardPanelSpec } from './dashboardColumns';
import { ICON_CHECK_CIRCLE, ICON_CLOCK, ICON_PEOPLE, ICON_X_CIRCLE } from './tileIcons';

export type HodTileKey = 'inside' | 'approvedToday' | 'pending' | 'rejectedToday';

export const HOD_TILE_KEYS: HodTileKey[] = ['inside', 'approvedToday', 'pending', 'rejectedToday'];

export type HodTileMeta = {
  /** SVG path, from the shared glyph set. */
  icon: string;
  /** Icon-ring classes, from the shared palette. */
  ring: string;
};

export const HOD_TILE_META: Record<HodTileKey, HodTileMeta> = {
  inside: { icon: ICON_PEOPLE, ring: 'border-brand-400/30 text-brand-400' },
  approvedToday: { icon: ICON_CHECK_CIRCLE, ring: 'border-success-500/40 text-success-500' },
  pending: { icon: ICON_CLOCK, ring: 'border-warning-400/40 text-warning-400' },
  rejectedToday: { icon: ICON_X_CIRCLE, ring: 'border-danger-500/30 text-danger-400' },
};

// The heading IS the tile's label — one string, so a tile and the list it opens
// cannot be named two different things. No Department column anywhere: an HOD
// belongs to exactly one department and every row on this board is already
// scoped to it, so the column would print the same value on every line.
export const HOD_PANEL_SPEC: Record<HodTileKey, DashboardPanelSpec> = {
  inside: {
    heading: 'On Site Now',
    empty: 'No visitor from this department is on site.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.scheduled, COLUMN.checkedIn, COLUMN.status],
  },
  approvedToday: {
    heading: 'Approved Today',
    empty: 'No visit has been approved today.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.scheduled, COLUMN.status],
  },
  // A walk-in with nobody's decision on it. It has no slot and no entry — only
  // the moment it was raised at reception, which is what the visitor standing
  // there is waiting against.
  pending: {
    heading: 'Awaiting Your Decision',
    empty: 'No walk-in requests are waiting at reception.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.requested, COLUMN.status],
  },
  // The REASON is carried, because a refusal without one is an assertion nobody
  // can check, and `visits.rejection_reason` is the only place the decision's
  // justification is written down.
  rejectedToday: {
    heading: 'Declined Today',
    empty: 'Nothing was declined today.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.scheduled, COLUMN.reason],
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
};

/** One slice per tile. The console's own desk list is reused verbatim where it
 *  exists — the desk and the tile must act on the same rows. */
export function hodTileVisits({ day, onSite, walkIns }: HodTileSources): Record<HodTileKey, Visit[]> {
  return {
    inside: onSite,
    approvedToday: day.filter((v) => v.status === 'approved' || v.status === 'walkin_approved'),
    pending: walkIns,
    rejectedToday: day.filter((v) => v.status === 'rejected'),
  };
}
