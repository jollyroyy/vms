// When was a visit actually approved?
//
// There is no `visits.approved_at` column, and adding one would only duplicate
// state the audit trail already owns. Two different things record an approval,
// depending on how the visit was born:
//
//   * A visit that was *raised* pending and later decided (walk-in requests,
//     kiosk registrations, HOD approvals) gets an `audit_logs` row with action
//     `visit_approved` — see `log_visit_approval` in migration 044. That row's
//     `created_at` is the exact approval instant, and `attachVisitActors`
//     surfaces it as `approvedAt`.
//   * A pre-approval is INSERTed already in the `approved` state, so the
//     trigger (which only fires on `pending_approval -> approved`) never logs
//     anything. For those rows the visit's own `created_at` *is* the approval
//     instant — the row did not exist before the HOD approved it.
//
// So: prefer the audit log, fall back to `created_at`, and only when the
// status proves an approval actually happened. A `pending_approval` visit has
// no approval time, and a visit rejected straight out of `pending_approval`
// never had one either — reporting `created_at` for those would be a lie.
import type { VisitStatus } from '../types/index';

/** Whether reaching this status means the visit must have been approved at some point. */
const IMPLIES_PRIOR_APPROVAL: Record<VisitStatus, boolean> = {
  pending_approval: false,
  // A rejection can follow an approval, but it can equally follow nothing at
  // all. Only the audit log can tell the two apart, so no created_at fallback.
  rejected: false,
  approved: true,
  walkin_approved: true,
  checked_in: true,
  checked_out: true,
  // Both are only reachable from an approved state (see the status-transition
  // guard in migration 044).
  cancelled: true,
  no_show: true,
  // Same reasoning: only an approved visit can lapse. Reports shows the
  // approval instant for an expired pass, which is the interesting part —
  // somebody approved this and it was never used.
  expired: true,
};

export type ApprovableVisit = {
  status: VisitStatus;
  created_at: string;
  approvedAt?: string | null;
};

/** The instant this visit was approved, or null if it never was. */
export function approvalTimestamp(visit: ApprovableVisit): string | null {
  if (visit.approvedAt) return visit.approvedAt;
  return IMPLIES_PRIOR_APPROVAL[visit.status] ? visit.created_at : null;
}
