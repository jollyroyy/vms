import type { Visit } from '../types/index';
import { approvalTimestamp, type ApprovableVisit } from './visitApproval';
import { visitOrigin } from './visitOrigin';

// The instants that make up a visit's life at the gate: it was approved, it was
// due, the visitor came in, the visitor left.
//
// THE SLOT THE PRE-APPROVER CHOSE IS ONE OF THEM (client instruction,
// 2026-08-15). `scheduled_for` is the only time on a visit that a human decided
// rather than the system recording — the HOD said "come at 10:30" — and it is
// the one the guard is implicitly judging every arrival against. Without it the
// timeline said when the visitor arrived but never whether that was the time
// they were expected, which is the whole question behind an early or a late
// entry. It sits between the approval and the check-in: cleared at X, due at Y,
// arrived at Z. A walk-in never sets `scheduled_for`, so this entry simply does
// not exist for one — correctly, since nobody booked them a time.
//
// The gate's own screen never showed any of them. The Inside Now frame's step
// tracker says WHETHER each stage happened; a guard asked to account for a
// visitor also needs WHEN, and the numbers were only reachable from Reports —
// a surface the guard has no route to.
//
// THE DATE IS PRINTED ONCE, THE TIMES ON EVERY ENTRY (client instruction,
// 2026-08-15). Approval, entry and exit almost always fall on one day, so
// repeating that day three times spends the line the guard reads fastest on
// the fact that varies least. The exception is the one that matters and is
// therefore NOT collapsed: when the entries span more than one IST day — an
// approval booked last week, a contractor who stayed the night — `date` is
// null and each entry carries its own. A bare "08:15 AM" on a stay that
// crossed midnight is the same defect CLAUDE.md removed from every
// `scheduled_for` line: it says when but not whether that when was today.
//
// IST is explicit, not the browser's zone. This deployment is IST wherever the
// laptop is, which is the same rule `istLocalToUtcIso` follows.
const IST = 'Asia/Kolkata';

/** "14 Aug 2026", in IST. */
export function istDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: IST, day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** "10:30 AM", in IST. */
export function istTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export type VisitTimelineKey = 'approved' | 'scheduled' | 'checked_in' | 'checked_out';

export type VisitTimelineEntry = {
  key: VisitTimelineKey;
  label: string;
  iso: string;
  /** Always present. */
  time: string;
  /** Set only when this entry falls on a different IST day from its siblings. */
  date: string | null;
};

export type VisitTimeline = {
  /** The single date line, or null when the entries span more than one IST day. */
  date: string | null;
  entries: VisitTimelineEntry[];
};

export type TimelineVisit = ApprovableVisit &
  Pick<Visit, 'scheduled_for' | 'checked_in_at' | 'checked_out_at'>;

const usable = (iso: string | null | undefined): iso is string =>
  Boolean(iso) && !Number.isNaN(new Date(iso as string).getTime());

export function buildVisitTimeline(visit: TimelineVisit): VisitTimeline {
  const raw: Array<Pick<VisitTimelineEntry, 'key' | 'label' | 'iso'>> = [];

  // The approval instant, for a PRE-APPROVED visitor only (client instruction).
  // A walk-in's approval happened minutes ago, at this gate, in front of this
  // guard — it is the thing they just watched. A pre-approval's happened
  // elsewhere, possibly days earlier, and is the one they cannot otherwise see.
  // `approvalTimestamp` is the authority: there is no `visits.approved_at`, so
  // it resolves the audit-log row and only falls back to `created_at` for a
  // status that proves a prior approval.
  const approvedAt = visitOrigin(visit) === 'pre_approved' ? approvalTimestamp(visit) : null;
  if (usable(approvedAt)) raw.push({ key: 'approved', label: 'Approved', iso: approvedAt });
  // The slot the pre-approver booked. Read straight off the column — unlike the
  // approval instant there is nothing to resolve, because this is the one time
  // on the visit a person typed. Labelled "Scheduled" to match the words on the
  // pass the visitor is holding (PreApprovalPass prints SCHEDULED AT).
  if (usable(visit.scheduled_for)) raw.push({ key: 'scheduled', label: 'Scheduled', iso: visit.scheduled_for });
  if (usable(visit.checked_in_at)) raw.push({ key: 'checked_in', label: 'Checked in', iso: visit.checked_in_at });
  if (usable(visit.checked_out_at)) raw.push({ key: 'checked_out', label: 'Checked out', iso: visit.checked_out_at });

  const dates = raw.map((r) => istDateLabel(r.iso));
  const oneDay = raw.length > 0 && dates.every((d) => d === dates[0]);

  return {
    date: oneDay ? dates[0] ?? null : null,
    entries: raw.map((r, i) => ({
      ...r,
      time: istTimeLabel(r.iso),
      date: oneDay ? null : dates[i] ?? null,
    })),
  };
}
