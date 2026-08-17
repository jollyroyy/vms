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
//
// THE TWO CLEARANCES ARE TWO TILES (client instruction, 2026-08-16). "Approved
// Today" carried `approved` and `walkin_approved` in one number, and those are
// two different acts by two different people: a pre-approval is a pass THIS HOD
// raised in advance on /approvals, a walk-in approval is a decision they made
// on a request the gate pushed at them minutes ago. An HOD asking "how many
// passes did I issue today?" and "how many people did I clear at the door?" was
// getting one answer to both questions, and neither list could be opened on its
// own. The split is not a duplicate of the Type column below it — the column
// tells you what a row IS, these tiles are the two lanes you can open.
// THE BOARD CARRIES CHECK-INS AND CHECK-OUTS (client instruction, 2026-08-17),
// scoped to this HOD's own department like every other figure on the screen.
// The gap they close: the board could say how many passes an HOD had issued and
// how many of their visitors were on site, and left "how many of my visitors
// actually turned up today" and "how many have gone home" to be worked out as
// the difference — arithmetic the HOD was doing in their head, and arithmetic
// that does not work, because `inside` is live and can hold a visitor who
// arrived yesterday evening. The guard board took the same two tiles for the
// same reason; this makes the two boards answer the gate's questions the same
// way, one org-wide and one department-wide.
//
// `checkedIn` is CUMULATIVE and `inside` is LIVE, and they are deliberately
// both here: `visits.status` holds one value, so a visitor who came and left is
// `checked_out`, and counting the status would answer "who is still here",
// never "how many came through". The invariant the guard board asserts holds on
// this board too — checkedIn === inside + checkedOut — for the department.
import type { Visit } from '../types/index';
import { COLUMN } from './dashboardColumns';
import type { DashboardPanelSpec } from './dashboardPanelSpec';
import { istDateKey, istDayStart } from './visitExpiry';
import { arrivedOn } from './adminDashboard';
import {
  ICON_CALENDAR, ICON_CHECK_CIRCLE, ICON_CLOCK, ICON_EXIT, ICON_PEOPLE,
  ICON_WALKING, ICON_X_CIRCLE,
} from './tileIcons';
import { isApprovedWalkIn, isGivenPreApproval } from './visitOrigin';

export type HodTileKey =
  | 'preApprovedToday' | 'walkInApprovedToday' | 'pending'
  | 'checkedIn' | 'inside' | 'checkedOut' | 'rejectedToday';

// The order a visit passes through the gate — cleared, waiting, arrived, on
// site, gone, refused — which is the order the guard board already reads in.
// Seven tiles is more than five, and a board that large is only legible if the
// eye can walk it in one direction.
export const HOD_TILE_KEYS: HodTileKey[] = [
  'preApprovedToday', 'walkInApprovedToday', 'pending',
  'checkedIn', 'inside', 'checkedOut', 'rejectedToday',
];

export type HodTileMeta = {
  /** SVG path, from the shared glyph set. */
  icon: string;
  /** Icon-ring classes, from the shared palette. */
  ring: string;
};

// The glyph is what tells the two clearance tiles apart — a calendar for the
// pass booked in advance, a walking figure for the person who turned up. The
// hue is never the only carrier: each tile's label says which lane it is.
export const HOD_TILE_META: Record<HodTileKey, HodTileMeta> = {
  preApprovedToday: { icon: ICON_CALENDAR, ring: 'border-brand-400/30 text-brand-400' },
  walkInApprovedToday: { icon: ICON_WALKING, ring: 'border-brand-400/30 text-brand-400' },
  pending: { icon: ICON_CLOCK, ring: 'border-warning-400/40 text-warning-400' },
  // The tick for the arrival and the doorway-arrow for the departure — the same
  // pairing the guard board uses, and never a second tick: two ticks side by
  // side would say the same thing about opposite events.
  checkedIn: { icon: ICON_CHECK_CIRCLE, ring: 'border-success-500/40 text-success-500' },
  inside: { icon: ICON_PEOPLE, ring: 'border-success-500/40 text-success-500' },
  checkedOut: { icon: ICON_EXIT, ring: 'border-navy-400/40 text-navy-700' },
  rejectedToday: { icon: ICON_X_CIRCLE, ring: 'border-danger-500/30 text-danger-400' },
};

// The heading IS the tile's label — one string, so a tile and the list it opens
// cannot be named two different things. No Department column anywhere: an HOD
// belongs to exactly one department and every row on this board is already
// scoped to it, so the column would print the same value on every line.
export const HOD_PANEL_SPEC: Record<HodTileKey, DashboardPanelSpec> = {
  // Both origins end up here, so this lane carries the Type column. Same cells
  // as the guard's In Premises panel, minus the ID proof (an HOD never sees a
  // visitor's document — VisitorDetails hides it for this viewer role, and a
  // column would put it back on the board) and minus the department.
  inside: {
    heading: 'On Site Now',
    empty: 'No visitor from this department is on site.',
    columns: [
      COLUMN.name, COLUMN.origin, COLUMN.purpose, COLUMN.host,
      COLUMN.scheduled, COLUMN.checkedIn, COLUMN.status,
    ],
  },
  // Passes this HOD raised in advance. Every row has a slot — that is what
  // makes it a pre-approval — so SCHEDULED is the subject, and no Type column:
  // the tile's own label has already said what these are.
  //
  // CHECKED IN earns its place now that the lane keeps a row after the visitor
  // arrives: it is what separates a pass still outstanding from one that has
  // been used, and an em dash in that column says "issued, nobody has come
  // through it yet" — the single most useful thing this list can tell an HOD.
  preApprovedToday: {
    heading: 'Pre-Approvals Given',
    empty: 'No pre-approval has been issued today.',
    columns: [
      COLUMN.name, COLUMN.purpose, COLUMN.host,
      COLUMN.scheduled, COLUMN.checkedIn, COLUMN.status,
    ],
  },
  // Walk-ins this HOD cleared. They have no slot, so REQUESTED — when the gate
  // raised the request — is the time they are read against, exactly as on the
  // guard's Approved Walk-ins panel. CHECKED IN for the same reason as above:
  // since migration 080 most rows here were admitted in the HOD's own click, and
  // the ones that were not are precisely the ones worth spotting.
  walkInApprovedToday: {
    heading: 'Walk-ins Approved',
    empty: 'No walk-in has been approved today.',
    columns: [
      COLUMN.name, COLUMN.purpose, COLUMN.host,
      COLUMN.requested, COLUMN.checkedIn, COLUMN.status,
    ],
  },
  // A walk-in with nobody's decision on it. It has no slot and no entry — only
  // the moment it was raised at reception, which is what the visitor standing
  // there is waiting against.
  //
  // It says WALK-IN (client instruction, 2026-08-16), the same edit the guard's
  // pending lane took: `pending_approval` is only ever reached from the gate's
  // walk-in register, so "Awaiting Your Decision" left an HOD wondering whether
  // a booked visitor could be sitting in it too.
  pending: {
    heading: 'Awaiting Walk-in Approval',
    empty: 'No walk-in requests are waiting at reception.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.requested, COLUMN.status],
  },
  // Everyone from this department the gate admitted today, still here or not.
  // Both times, because the question this tile is opened with is "when was that
  // visitor here?" — the same columns the guard's Checked In lane carries,
  // minus the ID proof (an HOD never sees a visitor's document) and the
  // department (every row on this board has the same one).
  checkedIn: {
    heading: 'Checked In',
    empty: 'Nobody from this department has come through the gate yet today.',
    columns: [
      COLUMN.name, COLUMN.origin, COLUMN.purpose, COLUMN.host,
      COLUMN.scheduled, COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status,
    ],
  },
  // Everyone from this department who has LEFT since the IST day began. The
  // exit is never an em dash on this lane — every row has one by membership —
  // which is what earns it the last time column, where the eye lands. No slot
  // column: by the time somebody has gone home, when they were BOOKED for is
  // the least interesting of the three stamps.
  checkedOut: {
    heading: 'Checked Out',
    empty: 'Nobody from this department has left yet today.',
    columns: [
      COLUMN.name, COLUMN.origin, COLUMN.purpose, COLUMN.host,
      COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status,
    ],
  },
  // The REASON is carried, because a refusal without one is an assertion nobody
  // can check, and `visits.rejection_reason` is the only place the decision's
  // justification is written down. Both origins can be declined, so Type again.
  rejectedToday: {
    heading: 'Declined',
    empty: 'Nothing was declined today.',
    columns: [COLUMN.name, COLUMN.origin, COLUMN.purpose, COLUMN.host, COLUMN.scheduled, COLUMN.reason],
  },
};

/** Did this visitor LEAVE on or after the IST day boundary?
 *
 *  Keyed on `checked_out_at`, NOT on `status === 'checked_out'`, and the two
 *  are different sets: a visitor who arrived at 21:00 yesterday and left at
 *  09:00 today is today's departure, one who arrived and left yesterday is not,
 *  and the status alone cannot tell them apart. Compared as INSTANTS, never as
 *  strings — PostgREST renders a timestamptz as `…+00:00` while `toISOString()`
 *  ends in `Z`, and `'+' < 'Z'`. This is `TILE_FILTER.checkedOut`'s rule
 *  verbatim, so the HOD's figure is a department-scoped slice of the guard's
 *  and not a second, differently-derived one. */
function departedToday(v: Visit, now: Date): boolean {
  if (!v.checked_out_at) return false;
  const left = new Date(v.checked_out_at).getTime();
  return !Number.isNaN(left) && left >= istDayStart(now).getTime();
}

export type HodTileSources = {
  /** Today's visits for this department, full rows.
   *
   *  "Today" here means created, ARRIVED or DEPARTED today — the query that
   *  feeds it ORs all three. A window on `created_at` alone loses the two rows
   *  these tiles exist for: a pre-approval raised last week whose visitor walked
   *  in this morning, and a visitor who arrived yesterday evening and went home
   *  after midnight. Both are today's traffic and neither was created today. */
  day: Visit[];
  /** Everyone from this department currently checked in (entry stamped today). */
  onSite: Visit[];
  /** Pending walk-ins, unbounded — a request raised at 11pm is still someone
   *  standing at the gate at 12:05am, which is why it is not day-bounded. */
  walkIns: Visit[];
};

/** One slice per tile. The console's own desk list is reused verbatim where it
 *  exists — the desk and the tile must act on the same rows. */
export function hodTileVisits(
  { day, onSite, walkIns }: HodTileSources,
  now: Date = new Date(),
): Record<HodTileKey, Visit[]> {
  return {
    inside: onSite,
    // Keyed on the ARRIVAL STAMP FALLING TODAY, not on the stamp merely
    // existing. A visitor came through the gate if and only if somebody stamped
    // them through it — but the `day` window now also carries rows that only
    // DEPARTED today (arrived 21:00 yesterday, left 09:00 this morning), and
    // those have an arrival stamp belonging to yesterday. Testing the stamp for
    // existence alone would file them as today's arrivals and make this tile
    // disagree with the flow chart underneath it, which counts by arrival hour.
    // `arrivedOn` is `lib/adminDashboard.ts`'s definition, reused rather than
    // restated so the two boards cannot mean different things by "arrived".
    checkedIn: day.filter((v) => arrivedOn(v, istDateKey(now))),
    checkedOut: day.filter((v) => departedToday(v, now)),
    // These two count CLEARANCES GIVEN, and a clearance is not undone by the
    // visitor turning up. Both lanes used to be keyed on the status alone
    // (`approved` for one, `walkin_approved` for the other) on the reasoning
    // that the status still proved the desk at that point in a visit's life.
    // Migration 080 ended that: the approver's click now admits the walk-in
    // outright, so the row goes `pending_approval -> checked_in` and the
    // walk-in lane emptied itself the instant the shortcut shipped — an HOD who
    // had just approved somebody found their own decision counted nowhere.
    //
    // Keyed on the clearance instead, via `visitOrigin`, both lanes keep the
    // row after entry. That is also why they now carry a Type column's worth of
    // ambiguity and rely on the inference — see the caveat in lib/visitOrigin.ts.
    preApprovedToday: day.filter(isGivenPreApproval),
    walkInApprovedToday: day.filter(isApprovedWalkIn),
    pending: walkIns,
    rejectedToday: day.filter((v) => v.status === 'rejected'),
  };
}
