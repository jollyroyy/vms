// Maps a Visit resolved by a QR scan into the same MatchItem shape the manual
// search flow builds in CheckInPanel's `allMatches` (see the `preApproved`
// mapping there). Keeping this in one pure function means the QR path and the
// manual path can never quietly drift apart on field mapping — CheckInPhotoStep
// only ever sees one MatchItem shape, regardless of how the guard got there.
import type { Visit } from '../../types/index';
import { approvalTimestamp } from '../../lib/visitApproval';
import { isDueToday } from '../../lib/visitExpiry';
import { visitOrigin } from '../../lib/visitOrigin';
import type { MatchItem } from './checkInTypes';

export function visitToMatchItem(visit: Visit & { approvedAt?: string | null }): MatchItem {
  // lib/visitOrigin.ts, never a local status test — see the note on
  // ApprovalType in checkInTypes.ts for what the status test got wrong.
  const isWalkin = visitOrigin(visit) === 'walk_in';
  return {
    id: `pre:${visit.id}`,
    source: 'pre_approved',
    visitorName: visit.visitor?.full_name ?? '',
    visitorPhone: visit.visitor?.phone ?? '',
    departmentName: visit.department?.name ?? '',
    departmentId: visit.department_id,
    purpose: visit.purpose,
    hostName: visit.host?.full_name ?? '',
    vendorName: visit.visitor?.vendor_name ?? '',
    approvalType: isWalkin ? 'walk_in' : 'pre_approved',
    approvedAt: approvalTimestamp(visit),
    scheduledFor: visit.scheduled_for,
    // Computed, not hardcoded true. The QR gate rejects an EXPIRED pass, but a
    // pass booked for next week is perfectly valid and simply not due yet, so
    // the scan path must report the same fact the search path does.
    dueToday: isDueToday(visit),
    status: visit.status,
    visitId: visit.id,
    // The QR itself encodes nothing but an opaque token. These come from the
    // visit row the token resolved to, and are what the guard checks the person
    // at the gate against.
    photoUrl: visit.photo_url ?? visit.photo_data,
    idType: visit.visitor?.id_type ?? null,
    idLast4: visit.visitor?.id_last4 ?? null,
    refNumber: visit.ref_number,
  };
}
