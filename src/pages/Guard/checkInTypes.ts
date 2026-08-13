// Shared check-in types, extracted out of CheckInPanel.tsx so plain .ts files
// (checkInFlow, checkInRecurring, useVisitHistorySearch, qrMatchItem) can
// import them — `tsc --noEmit` without a project file refuses to resolve a
// .tsx module when --jsx is unset (TS6142), which `npm run lint` trips on.
import type { VisitStatus } from '../../types/index';

export type MatchSource = 'pre_approved' | 'recurring';
export type ApprovalType = 'pre_approved' | 'walkin_approved' | 'recurring';

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
  visitId?: string;
  // Carried on the pass and shown back to the guard once it is scanned, so
  // they can check the person in front of them against the record. Absent for
  // recurring visitors, who have no visit row until they are checked in.
  photoUrl?: string | null;
  idType?: string | null;
  idLast4?: string | null;
  refNumber?: string | null;
}