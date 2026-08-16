import type { GuardTileKey } from './guardTiles';
import type { ReportVisit } from './reportRow';
import { formatStamp } from './formatDate';
import { maskIdProof } from './pii';
import { visitOrigin, visitOriginLabel } from './visitOrigin';
import { approverLabel } from './visitApprover';
import { overstayMs } from './visitExpiry';

// What the guard dashboard's one panel is CALLED, and which columns it shows,
// for each of the seven tiles above it.
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

export type DashboardColumn = {
  key: string;
  header: string;
  /** The cell's text. `now` is injected so the overrun column is testable. */
  value: (v: ReportVisit, now: Date) => string;
  /** Right-hand emphasis for a number a guard is chasing. */
  tone?: 'default' | 'warn';
};

/** "2h 15m", "45m", or "—". The overrun, in the units a guard says out loud. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// formatStamp, never a bare time: none of these lists is date-bounded (a
// pre-approval booked last week for today, a visitor still inside from last
// night), so "03:30" would say when but not whether that when is today. It
// prints the date as well whenever the instant is not today. See CLAUDE.md.
const stamp = (iso: string | null | undefined, now: Date) => (iso ? formatStamp(iso, now) : '—');

const NAME: DashboardColumn = {
  key: 'name', header: 'Name',
  value: (v) => v.visitor?.full_name ?? 'Unknown',
};
const PURPOSE: DashboardColumn = { key: 'purpose', header: 'Purpose', value: (v) => v.purpose };
const HOST: DashboardColumn = { key: 'host', header: 'Host', value: (v) => v.host?.full_name ?? '—' };
const DEPARTMENT: DashboardColumn = {
  key: 'department', header: 'Department', value: (v) => v.department?.name ?? '—',
};

// The slot the PRE-APPROVER chose — the one time on a visit a human typed, and
// the thing an arrival is judged early or late against. Headed "Scheduled", the
// same word the pass and the visit timeline use, so the three cannot be read as
// three different facts. A walk-in has no slot and prints "Anytime", not a dash:
// nobody booked them a time, which is different from a time going unrecorded.
const SCHEDULED: DashboardColumn = {
  key: 'scheduled', header: 'Scheduled',
  value: (v, now) => (v.scheduled_for ? stamp(v.scheduled_for, now) : 'Anytime'),
};

/** When they actually came through the gate. */
const CHECKED_IN: DashboardColumn = {
  key: 'checkedIn', header: 'Checked In',
  value: (v, now) => stamp(v.checked_in_at, now),
};

/** When they left. An em dash here means "still inside", which is precisely the
 *  distinction a guard scanning this column is looking for. */
const CHECKED_OUT: DashboardColumn = {
  key: 'checkedOut', header: 'Checked Out',
  value: (v, now) => stamp(v.checked_out_at, now),
};

/** When the walk-in was raised at the gate — the clock the host is running late
 *  against, and the only time a pending walk-in has at all. */
const REQUESTED: DashboardColumn = {
  key: 'requested', header: 'Requested',
  value: (v, now) => stamp(v.created_at, now),
};

// How far past their deadline this visitor is. It shares `overstayDeadline`
// with `isOverstaying`, the predicate that put the row in this list, so the
// number and the membership can never disagree.
const OVERSTAY: DashboardColumn = {
  key: 'overstay', header: 'Overstaying By',
  value: (v, now) => formatDuration(overstayMs(v, now)),
  tone: 'warn',
};

// WHAT KIND of document was taken off this visitor (client instruction,
// 2026-08-15). It is the one fact on the row a guard may later be asked to
// account for — "who did you let in, and what did you check?" — and it was
// reachable only by opening the popup's ID tab, one click deep, on a board
// whose whole job is being readable at a glance.
//
// The TYPE is the answer, so it is printed even when the digits are missing;
// `maskIdProof` supplies the redacted number when they are there, so the
// redaction rule stays in lib/pii.ts and cannot drift from Reports, the pass or
// the badge. "Not recorded" rather than a dash when nothing is on record: a
// dash reads as a document whose name went unwritten, and the honest answer is
// that nothing was taken.
const ID_PROOF: DashboardColumn = {
  key: 'idProof', header: 'ID Proof',
  value: (v) => {
    const type = v.visitor?.id_type?.trim();
    if (!type) return 'Not recorded';
    const masked = maskIdProof(type, v.visitor?.id_last4);
    return masked === '—' ? type : masked;
  },
};

// WHICH DESK this visitor came through — booked ahead, or turned up
// unannounced (client instruction, 2026-08-16: "always everybody should be able
// to see who is walk-in and who is pre-approved"). It is `lib/visitOrigin.ts`,
// the same inference the guard's card makes, so a visitor cannot read as a
// walk-in on one screen and a pre-approval on another.
//
// It is headed "Type of Visitor" in full (client instruction, 2026-08-16) and
// goes on EVERY lane whose rows can be of both kinds — which, after that
// instruction, is every lane except the four whose membership rule fixes the
// answer. On the pending and approved-walk-in lanes every row is a walk-in by
// definition, and on the expected and pre-approval lanes every row is a
// pre-approval, so the column would print one value on every line — a column
// that says nothing, and the tile's own label has already said it.
const ORIGIN: DashboardColumn = {
  key: 'origin', header: 'Type of Visitor',
  value: (v) => visitOriginLabel(visitOrigin(v)),
};

const STATUS: DashboardColumn = { key: 'status', header: 'Status', value: () => '' };

// WHO refused, resolved from the `visit_rejected` audit row — the same field
// `guardTiles.ts` splits the two refusal tiles on, so the tile a row is in and
// the name printed beside it cannot disagree. "Not recorded" rather than a dash
// when the audit line is unreadable: a dash reads as "nobody", and the honest
// answer is that we could not resolve who.
const DECIDED_BY: DashboardColumn = {
  key: 'decidedBy', header: 'Refused By',
  value: (v) => (v.actor ? `${v.actor.name} (${v.actor.role})` : 'Not recorded'),
};

// The justification. On a guard's refusal it is mandatory by construction; on
// an HOD's decline it is whatever they typed. Never truncated to a fixed width
// here — a clipped reason is indistinguishable from a complete one.
// WHO cleared this visitor (client instruction, 2026-08-16). Since migration
// 080 an approved walk-in lands in `checked_in` in the approver's own click, so
// the "Walk-in approved" badge that used to carry the fact is gone by the time
// a guard reads the row — and nothing else on the board said a host had said
// yes, or which host. This is that answer.
//
// The NAME only, no department: every row on the guard's board is one gate's
// traffic and the department is already its own column, so the extra words buy
// nothing and cost the readability the client asked to protect. The admin
// register calls the same function with `withDepartment` (see reportColumns).
const APPROVED_BY: DashboardColumn = {
  key: 'approvedBy', header: 'Approved By',
  value: (v) => approverLabel(v),
};

const REASON: DashboardColumn = {
  key: 'reason', header: 'Reason',
  value: (v) => v.rejection_reason?.trim() || 'No reason recorded',
};

// The cells, addressable by name. Exported for the HOD dashboard (2026-08-16),
// which draws its panels with the same table and therefore must draw them with
// the same cells: "Scheduled" has to mean the same thing, print the same way
// and fall back to the same word on both boards, or the two views are only
// coincidentally alike. Composing a panel is picking from this record — it is
// not a licence to write a one-off column inline.
export const COLUMN = {
  name: NAME,
  purpose: PURPOSE,
  host: HOST,
  department: DEPARTMENT,
  scheduled: SCHEDULED,
  checkedIn: CHECKED_IN,
  checkedOut: CHECKED_OUT,
  requested: REQUESTED,
  overstay: OVERSTAY,
  origin: ORIGIN,
  idProof: ID_PROOF,
  status: STATUS,
  decidedBy: DECIDED_BY,
  approvedBy: APPROVED_BY,
  reason: REASON,
} as const;

export type DashboardPanelSpec = {
  /** The panel's heading — it IS the tile's label, so the two cannot drift. */
  heading: string;
  empty: string;
  columns: DashboardColumn[];
};

export const PANEL_SPEC: Record<GuardTileKey, DashboardPanelSpec> = {
  // Nobody here has arrived, so a Checked In column would be an em dash on
  // every row. The slot is the whole subject.
  expected: {
    heading: 'Expected Today',
    empty: 'No visitors waiting at the gate right now.',
    columns: [NAME, PURPOSE, HOST, DEPARTMENT, SCHEDULED, STATUS],
  },
  // Everyone through the gate today, still here or not. Both times, because the
  // question this tile is opened with is "when was that visitor here?".
  checked: {
    heading: 'Checked In Today',
    empty: 'Nobody has come through the gate yet today.',
    columns: [NAME, ORIGIN, APPROVED_BY, ID_PROOF, PURPOSE, HOST, SCHEDULED, CHECKED_IN, CHECKED_OUT, STATUS],
  },
  // The list you hand a fire marshal. No exit column — by definition none of
  // them has one.
  inside: {
    heading: 'In Premises',
    empty: 'Nobody is inside right now.',
    columns: [NAME, ORIGIN, APPROVED_BY, ID_PROOF, PURPOSE, HOST, DEPARTMENT, SCHEDULED, CHECKED_IN, STATUS],
  },
  // The overrun is why the row is here, so it sits last, where the eye lands.
  overstaying: {
    heading: 'Overstaying',
    empty: 'Nobody is overstaying.',
    columns: [NAME, ORIGIN, ID_PROOF, PURPOSE, HOST, CHECKED_IN, OVERSTAY, STATUS],
  },
  all: {
    heading: 'All Visitors',
    empty: 'No visitor activity yet today.',
    columns: [NAME, ORIGIN, APPROVED_BY, ID_PROOF, PURPOSE, HOST, DEPARTMENT, SCHEDULED, CHECKED_IN, CHECKED_OUT, STATUS],
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
    columns: [NAME, PURPOSE, HOST, DEPARTMENT, REQUESTED, STATUS],
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
    columns: [NAME, APPROVED_BY, PURPOSE, HOST, DEPARTMENT, REQUESTED, CHECKED_IN, STATUS],
  },
  // The two refusal lanes. Both carry the REASON, because a refusal without one
  // is an assertion nobody can check, and `visits.rejection_reason` is the only
  // place the decision's justification is written down.
  declinedByHost: {
    heading: 'Declined by Host',
    empty: 'No requests were declined.',
    columns: [NAME, ORIGIN, PURPOSE, HOST, DEPARTMENT, SCHEDULED, DECIDED_BY, REASON],
  },
  refusedByGuard: {
    heading: 'Entry Refused at the Gate',
    empty: 'Nobody was refused entry.',
    columns: [NAME, ORIGIN, PURPOSE, HOST, DEPARTMENT, SCHEDULED, DECIDED_BY, REASON],
  },
};
