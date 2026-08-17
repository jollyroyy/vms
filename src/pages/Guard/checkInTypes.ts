// Shared check-in types, extracted out of CheckInPanel.tsx so plain .ts files
// (checkInFlow, checkInRecurring, useVisitHistorySearch, qrMatchItem) can
// import them — `tsc --noEmit` without a project file refuses to resolve a
// .tsx module when --jsx is unset (TS6142), which `npm run lint` trips on.
import type { VisitStatus } from '../../types/index';

export type MatchSource = 'pre_approved' | 'recurring';

// WHICH DESK this visitor came through — the check-in flow's copy of the
// dashboard's "Type of Visitor" column, and it must be the SAME answer.
//
// The member used to be named `walkin_approved`, after the status, and was
// derived from `status === 'walkin_approved'`. Migration 080 ended that: the
// approver admits a walk-in in the same click, so a host-cleared walk-in rests
// in `checked_in` and the status test called them "Pre-Approved" at the gate —
// disagreeing with every other surface about the same row. It is now derived
// from `lib/visitOrigin.ts`, the one place that question is answered, and named
// after the fact rather than after a status it no longer tracks.
//
// `recurring` is a genuine third case, not a third origin: a standing visitor
// has no visit row at all until check-in creates one.
export type ApprovalType = 'pre_approved' | 'walk_in' | 'recurring';

export interface MatchItem {
  id: string;
  source: MatchSource;
  visitorName: string;
  visitorPhone: string;
  departmentName: string;
  /** Kept alongside the name so the department picker can narrow server-side
   *  search hits too — those arrive from lib/searchVisits, not from the
   *  panel's own fetch, so they have no other way to be filtered. */
  departmentId: string;
  purpose: string;
  hostName: string;
  vendorName: string;
  approvalType: ApprovalType;
  approvedAt: string | null;
  scheduledFor: string | null;
  /** False for a pass booked for a later day, or one whose day has passed.
   *  Such a row is findable BY SEARCH but never checkable-in — see
   *  buildMatchItems for why the two differ. */
  dueToday: boolean;
  /** The visit's own status, so a search hit can say what became of the pass.
   *  Null only for recurring visitors, who have no visit row until check-in.
   *  A pass that is closed (checked_out / rejected / cancelled / no_show /
   *  expired) is still findable — searching answers "does this exist?" — but
   *  is never checkable-in, which `isCheckableStatus` decides. */
  status: VisitStatus | null;
  /** When the gate stamped this visitor in and out (client instruction,
   *  2026-08-17: a scanned pass must report "what time he checked in").
   *
   *  Both null on the ordinary arrival — that is the point of the scan — and
   *  populated on a pass the guard scans a second time, which is precisely the
   *  case where the record has to say what already happened rather than a bare
   *  "already checked in" refusal. Null for recurring visitors, who have no
   *  visit row yet. */
  checkedInAt: string | null;
  checkedOutAt: string | null;
  visitId?: string;
  // Carried on the pass and shown back to the guard once it is scanned, so
  // they can check the person in front of them against the record. Absent for
  // recurring visitors, who have no visit row until they are checked in.
  photoUrl?: string | null;
  idType?: string | null;
  idLast4?: string | null;
  refNumber?: string | null;
}