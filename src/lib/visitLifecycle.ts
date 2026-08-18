// S1/S2a/S8 — visit state machine and auto-close logic.
// Status transitions are the server-authoritative truth (SEC-3); this module
// backs the Postgres trigger that enforces them and the seed script.
//
// The one import is a NUMBER, not machinery: the minutes a slot may sit behind
// its own booking. `validatePreApproval` refuses to create a row outside that
// tolerance and `isKeepableSlot` declines to judge the ones already stored, so
// the two have to be the same number and there is only one of it.
import { SLOT_BACKDATE_TOLERANCE_MINUTES } from './visitExpiry';

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
  // `checked_in` is NOT reachable from here (migration 083, 2026-08-17). It was
  // for one day: 080 let the approver admit the walk-in in the same act as the
  // decision, on the grounds that the registration form already carried the ID
  // scan and the photo the old gate step collected. It did not carry the
  // VISITOR CARD NUMBER, so every visitor admitted that way reached check-out
  // with nothing for the card-return gate to demand back. 083 puts the
  // admission back at the gate, where the card is physically handed over: the
  // host clears the request to `walkin_approved`, and the guard's own check-in
  // — which will not submit without a card number — is what makes it
  // `checked_in`.
  //
  // Mirrors `enforce_visit_update_rules` — this map and that trigger must not
  // disagree about what the database will accept.
  // `lapsed` is migration 082's day-end sweep: a request the host never
  // answered, closed when the day it was needed for ended. Reachable from here
  // and nowhere else — an approval that lapses is `expired`, which is a
  // different fact and a different status.
  pending_approval: ['approved', 'walkin_approved', 'rejected', 'lapsed'],
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
  /** A UTC instant, already converted out of the form's IST wall clock by
   *  `istLocalToUtcIso` — validating the typed string would compare a
   *  different moment than the one being stored. */
  scheduled_for: string;
  /** Optional. Set for visits spanning a night or several days — see migration 073. */
  expected_departure?: string;
  /** Injectable clock, so the past-slot rule is testable without freezing time
   *  globally. Callers leave it out. */
  now?: Date;
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
  // NOBODY CAN ARRIVE ON TIME FOR A SLOT THAT HAS ALREADY PASSED (client
  // report, 2026-08-18: a visitor booked for 12 am and arriving at 11 am was
  // being called late). The live row that prompted it was raised at 10:08 in
  // the morning for 00:10 THAT SAME morning — a picker left on AM — and every
  // screen then did exactly as it was told and reported eleven hours of
  // lateness against a time the host never meant.
  //
  // A booking is for the future or for right now; the tolerance is the same
  // fifteen minutes `isKeepableSlot` allows, so the form refuses precisely the
  // rows the chips would have had to ignore. It is deliberately generous in
  // the other direction — a pass raised for a visitor already at the desk is
  // ordinary, and this must not turn that into an error message.
  const slot = new Date(input.scheduled_for).getTime();
  if (!Number.isNaN(slot)) {
    const floor = (input.now ?? new Date()).getTime() - SLOT_BACKDATE_TOLERANCE_MINUTES * 60_000;
    if (slot < floor) {
      return 'Scheduled date and time cannot be in the past — check AM/PM';
    }
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
