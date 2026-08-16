import type { GuardTileKey } from '../../lib/guardTiles';
import type { ReportVisit } from '../../lib/reportRow';
import {
  ICON_CALENDAR, ICON_CHECK_CIRCLE, ICON_CLOCK, ICON_LIST, ICON_PEOPLE,
  ICON_SHIELD_X, ICON_WALKING, ICON_X_CIRCLE,
} from '../../lib/tileIcons';

// Look and sort order for the guard dashboard's nine tiles. Split out of
// GuardDashboardMain so that file stays layout, and stays under the 300-line
// cap. The tile's LABEL is deliberately not here — it is the panel heading in
// lib/dashboardColumns.ts, so a tile and the list it opens cannot be named two
// different things.
//
// The palette is ours, not a mockup's: brand for the pre-booked lane, success
// for who is on site, warning for what is owed a human's attention, danger for
// a refusal. A hue is only information if it means the same thing on every
// screen — which is exactly why the glyph PATHS now live in lib/tileIcons.ts:
// the HOD board draws from the same set, and a second copy of a path is a
// second chance for one board's "people" icon to drift from the other's.

export const TILE_ICONS: Record<GuardTileKey, string> = {
  expected: ICON_CALENDAR,
  checked: ICON_CHECK_CIRCLE,
  inside: ICON_PEOPLE,
  overstaying: ICON_CLOCK,
  all: ICON_LIST,
  pending: ICON_CLOCK,
  walkinApproved: ICON_WALKING,
  declinedByHost: ICON_X_CIRCLE,
  refusedByGuard: ICON_SHIELD_X,
};

export const TILE_RING: Record<GuardTileKey, string> = {
  expected: 'border-brand-500/30 text-brand-500',
  checked: 'border-success-500/40 text-success-500',
  inside: 'border-brand-400/30 text-brand-400',
  overstaying: 'border-warning-400/40 text-warning-400',
  all: 'border-navy-400/30 text-navy-700',
  pending: 'border-warning-400/40 text-warning-400',
  walkinApproved: 'border-accent-500/40 text-accent-500',
  declinedByHost: 'border-danger-500/30 text-danger-400',
  refusedByGuard: 'border-danger-500/40 text-danger-500',
};

// The instant each lane is READ BY, so "most relevant first" means the same
// thing as the tile's own subject. Rows nobody has acted on sort by when they
// are due; rows that happened sort by when they happened.
const SORT_KEY: Record<GuardTileKey, (v: ReportVisit) => string> = {
  expected: (v) => v.scheduled_for ?? v.created_at,
  checked: (v) => v.checked_in_at ?? v.created_at,
  inside: (v) => v.checked_in_at ?? v.created_at,
  overstaying: (v) => v.checked_in_at ?? v.created_at,
  all: (v) => v.checked_out_at ?? v.checked_in_at ?? v.scheduled_for ?? v.created_at,
  pending: (v) => v.created_at,
  walkinApproved: (v) => v.created_at,
  declinedByHost: (v) => v.actorAt ?? v.created_at,
  refusedByGuard: (v) => v.actorAt ?? v.created_at,
};

// Expected and Overstaying read FORWARDS — a list of people still to arrive is
// read soonest-first, and the longest overstay is the one to chase first. Every
// other lane is a record of what has happened, so the newest is on top.
const ASCENDING: Partial<Record<GuardTileKey, true>> = { expected: true, overstaying: true };

export function sortForTile(rows: ReportVisit[], tile: GuardTileKey): ReportVisit[] {
  const key = SORT_KEY[tile];
  const dir = ASCENDING[tile] ? 1 : -1;
  return [...rows].sort((a, b) => dir * (key(a) ?? '').localeCompare(key(b) ?? ''));
}
