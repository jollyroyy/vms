import type { Visit } from '../types/index';
import { istDateKey } from './visitExpiry';
import { arrivedOn } from './adminDashboard';

// The Live Check-In tab's four tile figures and its two lanes — one predicate
// each, `guardTiles.ts`'s rule again: a tile's number and the rows a lane
// opens must come from the same test, or a tile could read one figure while
// its list showed another.
//
// `arrivedOn` is IMPORTED from `adminDashboard.ts`, not re-derived — "who came
// through the gate today" is one question and this tab must answer it the
// same way the Dashboard tab's Visitors Today tile does, or an admin reading
// both screens back-to-back would see two different counts for "today".

/** Left since the IST day began. */
export function departedOn(v: Visit, dayKey: string): boolean {
  return v.checked_out_at !== null && v.checked_out_at !== undefined
    && istDateKey(v.checked_out_at) === dayKey;
}

export type LiveCheckInKpis = {
  arrivedToday: number;
  currentlyInside: number;
  departedToday: number;
  awaitingApproval: number;
};

export function liveCheckInKpis(visits: Visit[], now: Date = new Date()): LiveCheckInKpis {
  const today = istDateKey(now);
  return {
    arrivedToday: visits.filter((v) => arrivedOn(v, today)).length,
    currentlyInside: visits.filter((v) => v.status === 'checked_in').length,
    departedToday: visits.filter((v) => departedOn(v, today)).length,
    awaitingApproval: visits.filter((v) => v.status === 'pending_approval').length,
  };
}

/** The Inside lane: everyone on site right now, oldest arrival first — the
 *  same ordering the guard's Entry & Exit tab uses, and for the same reason:
 *  the longest-present visitor is the one closest to an overstay. */
export function insideLane(visits: Visit[]): Visit[] {
  return visits
    .filter((v) => v.status === 'checked_in')
    .sort((a, b) => (a.checked_in_at ?? '').localeCompare(b.checked_in_at ?? ''));
}

/** The Checked Out lane: everyone who left since the IST day began, most
 *  recent departure first. */
export function departedLane(visits: Visit[], now: Date = new Date()): Visit[] {
  const today = istDateKey(now);
  return visits
    .filter((v) => departedOn(v, today))
    .sort((a, b) => (b.checked_out_at ?? '').localeCompare(a.checked_out_at ?? ''));
}
