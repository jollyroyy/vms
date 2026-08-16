import type { VisitStatus } from '../types/index';
import type { VisitActor } from './visitActors';

// WHO cleared this visitor — one rule, one wording, every surface.
//
// Client instruction, 2026-08-16. It is asked in three places and each of them
// used to answer it differently, or not at all:
//
//   · The GUARD's board, on a row that has already checked in. Since migration
//     080 an approved walk-in becomes `checked_in` in the approver's own click,
//     so the status badge that used to read "Walk-in approved" is gone by the
//     time the guard sees the row — and with it the only thing on screen that
//     said a host had cleared this person, and which host. This is that answer,
//     restored one column across.
//   · The ADMIN's register, which spans every department, so the name alone is
//     not enough: two organisations' worth of desks sign off visitors here and
//     "Priya Nair" says nothing about which one. Hence `withDepartment`.
//   · The HOD's own register, which must NOT carry it. An HOD reading their
//     department's report is reading their own decisions — printing "Approved
//     by <you>" on every line spends a column restating the reason the row is
//     on their screen at all. `Reports.tsx` simply does not include the column
//     for a department-scoped viewer; there is no per-role branch in here.
//
// The two halves are joined with a middle dot rather than stacked, because the
// cell also has to survive `table-layout: fixed` on A4 landscape.

/** Statuses that mean somebody, at some point, cleared this visitor. Mirrors
 *  `IMPLIES_PRIOR_APPROVAL` in visitApproval.ts — the timestamp and the name
 *  must never disagree about whether an approval happened. */
const IMPLIES_APPROVAL: Record<VisitStatus, boolean> = {
  pending_approval: false,
  rejected: false,
  approved: true,
  walkin_approved: true,
  checked_in: true,
  checked_out: true,
  cancelled: true,
  no_show: true,
  expired: true,
  // Nobody decided — the register reads "Not approved", which is the fact.
  lapsed: false,
};

export type ApprovedVisit = {
  status: VisitStatus;
  approvedBy?: VisitActor | null;
};

export type ApproverLabelOptions = {
  /** Append the approver's own department. The admin register wants it; the
   *  guard board does not — every row there is one gate's traffic and the extra
   *  words are what turns a readable column into a cluttered one. */
  withDepartment?: boolean;
  /** What to print when this visit was never approved at all. */
  none?: string;
};

/**
 * The approver's name, or an honest statement of why there is not one.
 *
 * The three outcomes are deliberately distinct, and never a bare dash:
 *   · a name        — the audit row resolved
 *   · "Not recorded" — the visit WAS approved but the audit line is unreadable
 *                      (a pre-approval issued before migration 080 started
 *                      writing one, or a profile since deleted)
 *   · the `none` text — nobody has approved this visit, which is not a gap in
 *                      the record but a fact about the visit
 * A dash would collapse the last two into one, and they mean opposite things.
 */
export function approverLabel(v: ApprovedVisit, opts: ApproverLabelOptions = {}): string {
  if (!IMPLIES_APPROVAL[v.status]) return opts.none ?? 'Not approved';
  const actor = v.approvedBy;
  if (!actor) return 'Not recorded';
  if (opts.withDepartment && actor.department) return `${actor.name} · ${actor.department}`;
  return actor.name;
}
