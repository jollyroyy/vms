import type { VisitStatus } from '../types/index';

// A row can be a search HIT without being checkable-in: searching now spans
// every open pass regardless of state, so a guard's search for a visitor's
// name can surface a pass that is checked_out, rejected, cancelled, no_show
// or expired — none of which should ever be actionable at the desk again.
// `dueToday` alone cannot decide this: a `rejected` visit scheduled for today
// has no `checked_in_at`, so `isDueToday` still returns TRUE for it. Status
// is the fact that actually says whether the pass is still open.
//
// Declared over the FULL VisitStatus union (not a partial include-list) so
// the compiler forces an explicit true/false decision whenever a new status
// value is added — see the "No fuzzy string matching for known enums" rule.
const CHECKABLE_BY_STATUS: Record<VisitStatus, boolean> = {
  pending_approval: false,
  approved: true,
  walkin_approved: true,
  checked_in: false,
  checked_out: false,
  rejected: false,
  cancelled: false,
  no_show: false,
  expired: false,
  lapsed: false,
};

/**
 * Whether a matched pass can still be acted on at the check-in desk.
 * `null` means a recurring visitor with no visit row yet — always checkable.
 */
export function isCheckableStatus(status: VisitStatus | null): boolean {
  if (status === null) return true;
  return CHECKABLE_BY_STATUS[status];
}
