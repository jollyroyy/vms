// The Check-in / Check-out desk, defined once.
//
// The guard's second nav item is a single destination with two lanes, because
// a guard standing at a gate is doing exactly one of two things: letting
// somebody in, or letting somebody out. Everything else on the Visitors surface
// is a list to read; this is the surface where the gate actually moves.
//
// This file is the single source of truth for the lanes, the same way
// lib/visitorSegments.ts is for the Visitors segments: the page reads it, the
// URL router reads it and the tab bar reads it, so a lane cannot exist in the
// tab bar without existing on the page.

export type GateLane = 'check-in' | 'check-out';

/** Nav order: in before out. A visitor arrives before they leave, and the
 *  check-in lane is the one a guard opens far more often. */
export const GATE_LANES: GateLane[] = ['check-in', 'check-out'];

export type LaneMeta = {
  /** Tab label. */
  label: string;
  /** Page heading for the lane. */
  title: string;
  subtitle: string;
};

export const GATE_LANE_META: Record<GateLane, LaneMeta> = {
  'check-in': {
    label: 'Check In',
    title: 'Check In a Visitor',
    subtitle: 'Scan the visitor’s pass, or search for it by name, phone or reference.',
  },
  'check-out': {
    label: 'Check Out',
    title: 'Check Out a Visitor',
    subtitle: 'Everyone currently on the premises. Collect the visitor card as they leave.',
  },
};

// Slug → lane. An unknown slug degrades onto the check-in lane rather than
// 404-ing into a blank page — the same rule segmentFromSlug follows, and for
// the same reason: a mistyped or stale URL must still land somewhere a guard
// can work. A lookup map, never an includes() chain (CLAUDE.md).
const SLUG_TO_LANE: Record<string, GateLane> = {
  'check-in': 'check-in',
  checkin: 'check-in',
  in: 'check-in',
  'check-out': 'check-out',
  checkout: 'check-out',
  out: 'check-out',
  exit: 'check-out',
};

/** Resolves a URL slug to a lane. Missing or unknown → the check-in lane. */
export function laneFromSlug(slug: string | undefined | null): GateLane {
  if (!slug) return 'check-in';
  return SLUG_TO_LANE[slug] ?? 'check-in';
}

export const GATE_BASE_PATH = '/guard/check-in-out';

/** Each lane is a real URL, so it can be bookmarked and the back button works
 *  between them — the same decision the Visitors segments made. */
export function lanePath(lane: GateLane): string {
  return `${GATE_BASE_PATH}/${lane}`;
}

// ── The two ways into a check-in ────────────────────────────────────────────
//
// Scanning and searching are the same job reached two ways, so they are modes
// of ONE lane rather than two nav items: the guard has a person in front of
// them holding a pass, and either the camera reads it or they type it in.
// Scan leads because it is the fast path and the one that needs no typing.
export type CheckInMode = 'scan' | 'search';

export const CHECK_IN_MODES: CheckInMode[] = ['scan', 'search'];

export const CHECK_IN_MODE_META: Record<CheckInMode, { label: string; hint: string }> = {
  scan: {
    label: 'Scan Pass',
    hint: 'Hold the QR pass to the camera, or upload it as an image or PDF.',
  },
  search: {
    label: 'Search Pass',
    hint: 'Find a booked visitor by name, phone number or reference.',
  },
};
