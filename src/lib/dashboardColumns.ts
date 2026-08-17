import type { ReportVisit } from './reportRow';
import { formatDateTime } from './formatDate';
import { maskIdProof } from './pii';
import { visitOrigin, visitOriginLabel } from './visitOrigin';
import { approverLabel } from './visitApprover';
import { overstayMs } from './visitExpiry';

// The COLUMN atoms every admin/guard/HOD dashboard table composes its panels
// from. See dashboardPanelSpec.ts for which tile shows which of these.

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

// ALWAYS THE DATE AS WELL AS THE TIME (client instruction, 2026-08-17). This
// was `formatStamp`, which prints a bare time for today and pays for the date
// only on an older instant — and none of these lists is date-bounded (a
// pre-approval booked last week for today, a visitor still inside from last
// night, an exit that crossed midnight), so a column mixed both shapes. The
// two are indistinguishable at a glance: a guard reading "03:30" cannot tell
// whether it is today's row rendered short or an older row whose date they
// skipped past. Stating the day on every row costs width and removes the
// question. Same change made to the Entry & Exit table's In/Out columns in the
// same pass; `now` is kept in the signature because callers inject a test
// clock and the columns' contract should not shift under them.
const stamp = (iso: string | null | undefined, _now: Date) => (iso ? formatDateTime(iso) : '—');

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
// three different facts.
//
// A walk-in has no slot by construction (WalkInRequest inserts scheduled_for as
// null) and reads "NA" (client instruction, 2026-08-16). It said "Anytime",
// which is promise-shaped — it reads as a window this visit was granted, when
// in fact nobody booked one, so there is no time the visitor can be early or
// late against. NA says the field does not apply to this kind of visit.
//
// Still not an em dash, for the reason the old wording got right: a dash reads
// as a slot that went unrecorded, and the honest answer is that this route
// never has one. It sits directly after Type of Visitor, which is what makes
// the NA legible — the pair reads "Walk-in / NA".
const SCHEDULED: DashboardColumn = {
  key: 'scheduled', header: 'Scheduled',
  value: (v, now) => (v.scheduled_for ? stamp(v.scheduled_for, now) : 'NA'),
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
//
// It sits IMMEDIATELY BEFORE Scheduled on every lane that has both (client
// instruction, 2026-08-16). The two are read together: a walk-in's slot prints
// "NA" and a pre-approval's prints a time, so side by side the pair says
// how the visit was raised and what was promised. It used to sit second, beside
// the name, four columns away from its own evidence. Overstaying is the one
// exception and only because it has no slot column — the overrun is measured
// from entry, so there the origin sits against Checked In instead. Guarded by
// dashboardColumns.test.ts, which asserts the adjacency rather than the index.
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

// The visitor's own email, for the admin Pre-Registration register — the one
// admin tab whose subject is a booking made on somebody's behalf, so "how do we
// reach them directly" is a real question there in a way it is not on the
// gate's boards. "Not recorded" rather than a dash: migration 085 made the
// column optional (a walk-in registered at reception rarely has one on file),
// and a dash would read as a value that went unwritten by mistake.
const EMAIL: DashboardColumn = {
  key: 'email', header: 'Email',
  value: (v) => v.visitor?.email ?? 'Not recorded',
};

// Whether the visitor was told about their own pass (migration 085's
// `invitation_sent_at`), as Yes/No rather than the timestamp itself — this sits
// beside `SCHEDULED` on the Pre-Registration table, and a second stamped
// column would be a second clock on a row that already carries one. The KPI
// tile above the table is what counts the timestamp; this column only ever
// answers the yes/no a reader is scanning for.
const INVITED: DashboardColumn = {
  key: 'invited', header: 'Invitation Sent',
  value: (v) => (v.invitation_sent_at ? 'Yes' : 'No'),
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
  email: EMAIL,
  invited: INVITED,
} as const;

// PANEL_SPEC (which tile shows which of the columns above) moved to
// `dashboardPanelSpec.ts` on 2026-08-17 to keep this file under the 300-line
// hard rule — it holds no logic of its own, only a per-tile pick from COLUMN,
// so nothing about the split changes what either file means. Import
// `PANEL_SPEC` / `DashboardPanelSpec` from there.
