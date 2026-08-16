// S1/S2a/S8 — visit state machine and auto-close logic.
// Status transitions are the server-authoritative truth (SEC-3); this module
// backs the Postgres trigger that enforces them and the seed script.

export type VisitStatus =
  | 'pending_approval'
  | 'approved'
  | 'walkin_approved'
  | 'checked_in'
  | 'checked_out'
  | 'rejected'
  | 'cancelled'
  | 'no_show'
  | 'lapsed';

export type Visit = {
  id: string;
  status: VisitStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  exitVerified: boolean | null;
};

const TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  // `checked_in` direct from `pending_approval` is migration 080's shortcut: the
  // approver admits the walk-in in the same act as the decision, because since
  // 2026-08-16 the registration form already carries the ID scan, the photo and
  // the card number that the old gate step existed to collect. Mirrors
  // `enforce_visit_update_rules` — this map and that trigger must not disagree
  // about what the database will accept.
  // `lapsed` is migration 082's day-end sweep: a request the host never
  // answered, closed when the day it was needed for ended. Reachable from here
  // and nowhere else — an approval that lapses is `expired`, which is a
  // different fact and a different status.
  pending_approval: ['approved', 'walkin_approved', 'checked_in', 'rejected', 'lapsed'],
  approved:         ['checked_in', 'cancelled', 'no_show'],
  walkin_approved:  ['checked_in'],
  checked_in:       ['checked_out'],
  checked_out:      [],
  rejected:         [],
  cancelled:        [],
  no_show:          ['approved'],  // HOD reactivate
  // Back to the decision that was never made, never straight to an approval:
  // reopening a request must put it in front of the host again, not invent the
  // answer they did not give.
  lapsed:           ['pending_approval'],
};

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

type PreApprovalInput = {
  department_id: string;
  purpose: string;
  scheduled_for: string;
  /** Optional. Set for visits spanning a night or several days — see migration 073. */
  expected_departure?: string;
};

export function validatePreApproval(input: PreApprovalInput): string | null {
  if (!input.department_id) return 'Department is required';
  if (!input.purpose) return 'Purpose is required';
  // Required, not optional. A pre-approval with no time is indistinguishable at
  // the gate from one for next month: the guard cannot tell whether the visitor
  // is early, expected, or long overdue, and `overdue` on the guard dashboard
  // can only be derived from a scheduled_for that exists.
  if (!input.scheduled_for) return 'Scheduled date and time is required';
  // Optional, but if given it has to be a duration rather than a contradiction.
  // Mirrors the visits_departure_after_arrival CHECK (073); the constraint is
  // the real enforcement, this just says so before the round trip.
  if (input.expected_departure && input.expected_departure <= input.scheduled_for) {
    return 'Expected departure must be after the scheduled arrival';
  }
  return null;
}

// FR-VIS-08: close any still-inside visit at day end and flag exit as unverified.
export function autoCloseAtDayEnd(visit: Visit, timestamp: string): Visit {
  if (visit.status !== 'checked_in') return visit;
  return {
    ...visit,
    status: 'checked_out',
    checkedOutAt: timestamp,
    exitVerified: false,
  };
}
