// Maps a Visit resolved by a QR scan into the same MatchItem shape the manual
// search flow builds in CheckInPanel's `allMatches` (see the `preApproved`
// mapping there). Keeping this in one pure function means the QR path and the
// manual path can never quietly drift apart on field mapping — CheckInPhotoStep
// only ever sees one MatchItem shape, regardless of how the guard got there.
import type { Visit } from '../../types/index';
import type { MatchItem } from './CheckInPanel';

export function visitToMatchItem(visit: Visit): MatchItem {
  const isWalkin = visit.status === 'walkin_approved';
  return {
    id: `pre:${visit.id}`,
    source: 'pre_approved',
    visitorName: visit.visitor?.full_name ?? '',
    visitorPhone: visit.visitor?.phone ?? '',
    departmentName: visit.department?.name ?? '',
    purpose: visit.purpose,
    hostName: visit.host?.full_name ?? '',
    company: visit.visitor?.company ?? '',
    approvalType: isWalkin ? 'walkin_approved' : 'pre_approved',
    approvedAt: visit.created_at,
    scheduledFor: visit.scheduled_for,
    visitId: visit.id,
  };
}
