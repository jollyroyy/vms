import type { GuardTileKey } from './guardTiles';
import { COLUMN } from './dashboardColumns';

// What the guard dashboard's one panel is CALLED, and which columns it shows,
// for each of the seven tiles above it.
//
// Split out of dashboardColumns.ts (2026-08-17) purely to keep that file under
// the 300-line hard rule as the COLUMN atoms it holds kept growing — the
// PANEL_SPEC below has no logic of its own, it only picks from COLUMN, so the
// split cost nothing conceptually. Every importer of `PANEL_SPEC` /
// `DashboardPanelSpec` now points here instead.
//
// The panel used to be a fixed "Expected Today" table with six fixed columns,
// beside a drill-down sheet that opened a different card layout for the same
// rows. One tile therefore had a table and the other six had cards, and the
// heading lied whenever a guard pressed anything but Expected Today. Now there
// is ONE panel: pressing a tile renames it and re-columns it (client
// instruction, 2026-08-15).
//
// The rule that governs which columns a tile gets: a column earns its place by
// answering a question that tile is opened WITH. Every lane carries who and why
// (name, purpose, host, department) because that never changes. The times are
// what vary — an unarrived visitor has a slot and no entry, an overstaying one
// has an entry and an overrun — and printing a column that is an em dash for
// every row in the lane is a column that says nothing.

export type DashboardPanelSpec = {
  /** The panel's heading — it IS the tile's label, so the two cannot drift. */
  heading: string;
  empty: string;
  columns: (typeof COLUMN)[keyof typeof COLUMN][];
};

export const PANEL_SPEC: Record<GuardTileKey, DashboardPanelSpec> = {
  // Nobody here has arrived, so a Checked In column would be an em dash on
  // every row. The slot is the whole subject.
  expected: {
    heading: 'Expected',
    empty: 'No visitors waiting at the gate right now.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.department, COLUMN.scheduled, COLUMN.status],
  },
  // Everyone through the gate today, still here or not. Both times, because the
  // question this tile is opened with is "when was that visitor here?".
  checked: {
    heading: 'Checked In',
    empty: 'Nobody has come through the gate yet today.',
    columns: [COLUMN.name, COLUMN.approvedBy, COLUMN.idProof, COLUMN.purpose, COLUMN.host, COLUMN.origin,
      COLUMN.scheduled, COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status],
  },
  // The list you hand a fire marshal. No exit column — by definition none of
  // them has one.
  inside: {
    heading: 'In Premises',
    empty: 'Nobody is inside right now.',
    columns: [COLUMN.name, COLUMN.approvedBy, COLUMN.idProof, COLUMN.purpose, COLUMN.host, COLUMN.department,
      COLUMN.origin, COLUMN.scheduled, COLUMN.checkedIn, COLUMN.status],
  },
  // Everyone who has LEFT since the IST day began (client instruction,
  // 2026-08-17). Both times, and in that order: the pair IS the visit, and the
  // exit column is never an em dash on this lane — every row has one by
  // membership, which is what earns it the last time column, where the eye
  // lands. Same columns as `checked` minus nothing, because a departure is
  // simply an arrival that finished, and a guard should not have to re-learn
  // the row when they press the next tile along.
  checkedOut: {
    heading: 'Checked Out',
    empty: 'Nobody has left yet today.',
    columns: [COLUMN.name, COLUMN.approvedBy, COLUMN.idProof, COLUMN.purpose, COLUMN.host, COLUMN.origin,
      COLUMN.scheduled, COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status],
  },
  // The overrun is why the row is here, so it sits last, where the eye lands.
  // No slot column on this lane — the overrun is measured from ENTRY — so the
  // origin sits against Checked In, this lane's time column, instead.
  overstaying: {
    heading: 'Overstaying',
    empty: 'Nobody is overstaying.',
    columns: [COLUMN.name, COLUMN.idProof, COLUMN.purpose, COLUMN.host, COLUMN.origin, COLUMN.checkedIn,
      COLUMN.overstay, COLUMN.status],
  },
  // THE END-OF-DAY CARD TALLY (client instruction, 2026-08-18). The card number
  // leads, because the guard reading this list is holding a stack and looking
  // for gaps in it; the name and the exit stamp are how they work out who to
  // call. No Scheduled column — a card exists only from check-in onwards, so
  // the slot says nothing about where it went.
  cardsOutstanding: {
    heading: 'Cards Not Returned',
    empty: 'Every visitor card issued today has come back.',
    columns: [COLUMN.card, COLUMN.name, COLUMN.host, COLUMN.department, COLUMN.checkedIn,
      COLUMN.checkedOut, COLUMN.status],
  },
  all: {
    heading: 'All Visitors',
    empty: 'No visitor activity yet today.',
    columns: [COLUMN.name, COLUMN.approvedBy, COLUMN.idProof, COLUMN.purpose, COLUMN.host, COLUMN.department,
      COLUMN.origin, COLUMN.scheduled, COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status],
  },
  // A walk-in with nobody's decision on it. It has no slot and no entry — only
  // the moment it was raised, which is what the host is late against.
  //
  // The heading says WALK-IN (client instruction, 2026-08-16): `pending_approval`
  // is only ever reached from the gate's walk-in register — a pre-approval is
  // created already approved and never passes through that status — so "Pending
  // Approval" left a guard wondering whether a booked visitor could be sitting in
  // it too.
  pending: {
    heading: 'Pending Walk-in Approvals',
    empty: 'Nothing waiting on a host.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.department, COLUMN.requested, COLUMN.status],
  },
  // Every walk-in a host cleared — still at the gate, and already inside.
  //
  // It used to be "cleared, not yet let in", which shared pending's shape
  // because neither lane could hold a row with an entry time. Migration 080
  // ended that: the approver admits the visitor in the same click, so most rows
  // here now DO have one. CHECKED_IN and APPROVED_BY are what that costs and
  // what it buys — when they came through, and which host said yes, the fact the
  // status badge used to carry before the row stopped resting in
  // `walkin_approved` long enough for anyone to read it.
  //
  // Still no Type column: every row on this lane is a walk-in by definition, so
  // it would print one word on every line.
  walkinApproved: {
    heading: 'Approved Walk-ins',
    empty: 'No walk-ins have been approved.',
    columns: [COLUMN.name, COLUMN.approvedBy, COLUMN.purpose, COLUMN.host, COLUMN.department, COLUMN.requested,
      COLUMN.checkedIn, COLUMN.status],
  },
  // The two refusal lanes. Both carry the REASON, because a refusal without one
  // is an assertion nobody can check, and `visits.rejection_reason` is the only
  // place the decision's justification is written down.
  declinedByHost: {
    heading: 'Declined by Host',
    empty: 'No requests were declined.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.department, COLUMN.origin, COLUMN.scheduled,
      COLUMN.decidedBy, COLUMN.reason],
  },
  refusedByGuard: {
    heading: 'Entry Refused at the Gate',
    empty: 'Nobody was refused entry.',
    columns: [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.department, COLUMN.origin, COLUMN.scheduled,
      COLUMN.decidedBy, COLUMN.reason],
  },
};
