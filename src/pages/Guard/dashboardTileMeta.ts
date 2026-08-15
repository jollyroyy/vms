import type { GuardTileKey } from '../../lib/guardTiles';
import type { ReportVisit } from '../../lib/reportRow';

// Look and sort order for the guard dashboard's nine tiles. Split out of
// GuardDashboardMain so that file stays layout, and stays under the 300-line
// cap. The tile's LABEL is deliberately not here — it is the panel heading in
// lib/dashboardColumns.ts, so a tile and the list it opens cannot be named two
// different things.
//
// The palette is ours, not a mockup's: brand for the pre-booked lane, success
// for who is on site, warning for what is owed a human's attention, danger for
// a refusal. A hue is only information if it means the same thing on every
// screen.

const CALENDAR =
  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5';
const CHECK_CIRCLE = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const PEOPLE =
  'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z';
const CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
const LIST = 'M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5';
const WALKING = 'M13.5 6.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM9 21l2.25-4.5L9 13.5l1.5-4.5 3 1.5 2.25 2.25M11.25 16.5L15 21';
const X_CIRCLE = 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const SHIELD_X =
  'M12 3l7.5 3v5.25c0 4.28-3.2 8.28-7.5 9.75-4.3-1.47-7.5-5.47-7.5-9.75V6L12 3zm-2.25 6.75l4.5 4.5m0-4.5l-4.5 4.5';

export const TILE_ICONS: Record<GuardTileKey, string> = {
  expected: CALENDAR,
  checked: CHECK_CIRCLE,
  inside: PEOPLE,
  overstaying: CLOCK,
  all: LIST,
  pending: CLOCK,
  walkinApproved: WALKING,
  declinedByHost: X_CIRCLE,
  // A shield, not a second cross: a refusal at the door is a different event
  // from a host's decline, and the two tiles sit side by side.
  refusedByGuard: SHIELD_X,
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
