// Builds the guard's check-in candidate list: today's approved visits plus the
// recurring visitors due today, filtered by the search box and department
// picker. Pure — extracted from CheckInPanel so the panel stays a state shell
// and this stays directly testable. The QR path builds the same MatchItem
// shape via qrMatchItem.ts; both must keep agreeing on field mapping.
import type { Department, Profile, RecurringVisit, Visit } from '../../types/index';
import { approvalTimestamp } from '../../lib/visitApproval';
import type { MatchItem } from './CheckInPanel';

export interface PreApprovedVisit extends Visit {
  actor?: { name: string; role: string } | null;
  actorAt?: string | null;
  approvedAt?: string | null;
}

export interface RecurringWithDept extends RecurringVisit {
  department?: Department;
  host?: Pick<Profile, 'id' | 'full_name'>;
}

export type MatchFilters = { search: string; deptFilter: string };

/** Digits only, so a typed "98765 43210" or "+91-98765-43210" still matches a
 *  stored "+919876543210". Comparing the raw strings meant any space, dash or
 *  bracket the guard typed silently killed the match. */
const digits = (s: string): string => s.replace(/\D/g, '');

/** True when the row survives the search box and the department picker. */
function matches(
  name: string,
  phone: string,
  departmentId: string,
  { search, deptFilter }: MatchFilters,
  refNumber?: string | null,
): boolean {
  const q = search.trim();
  if (q) {
    const lower = q.toLowerCase();
    const qDigits = digits(q);
    // A guard reading a pass off a phone screen types the REF NUMBER — it is
    // the most precise thing on the pass and the only field that identifies one
    // visit rather than one person. It was not searchable at all, which is why
    // pasting a reference returned nothing.
    const hitRef = !!refNumber && refNumber.toLowerCase().includes(lower);
    const hitName = name.toLowerCase().includes(lower);
    const hitPhone = qDigits.length > 0 && digits(phone).includes(qDigits);
    if (!hitRef && !hitName && !hitPhone) return false;
  }
  if (deptFilter && departmentId !== deptFilter) return false;
  return true;
}

/** Flattens approved visits and today's recurring visitors into one ordered candidate list. */
export function buildMatchItems(
  preApproved: PreApprovedVisit[],
  recurringToday: RecurringWithDept[],
  filters: MatchFilters,
): MatchItem[] {
  const items: MatchItem[] = [];

  preApproved.forEach((v) => {
    const name = v.visitor?.full_name ?? '';
    const phone = v.visitor?.phone ?? '';
    if (!matches(name, phone, v.department_id, filters, v.ref_number)) return;
    const isWalkin = v.status === 'walkin_approved';
    items.push({
      id: `pre:${v.id}`,
      source: 'pre_approved',
      visitorName: name,
      visitorPhone: phone,
      departmentName: v.department?.name ?? '',
      purpose: v.purpose,
      hostName: v.host?.full_name ?? '',
      vendorName: v.visitor?.vendor_name ?? '',
      approvalType: isWalkin ? 'walkin_approved' : 'pre_approved',
      approvedAt: approvalTimestamp(v),
      scheduledFor: v.scheduled_for,
      visitId: v.id,
      photoUrl: v.photo_url ?? v.photo_data,
      idType: v.visitor?.id_type ?? null,
      idLast4: v.visitor?.id_last4 ?? null,
      refNumber: v.ref_number,
    });
  });

  // A recurring visitor has no visit row until they are checked in, so there is
  // no photo, no ID on file and nothing that was ever approved — hence the
  // nulls rather than invented values.
  recurringToday.forEach((r) => {
    const name = r.visitor_name ?? '';
    const phone = r.visitor_phone ?? '';
    if (!matches(name, phone, r.department_id, filters)) return;
    items.push({
      id: `rec:${r.department_id}:${r.host_id}`,
      source: 'recurring',
      visitorName: name,
      visitorPhone: phone,
      departmentName: r.department?.name ?? '',
      purpose: r.purpose,
      hostName: r.host?.full_name ?? '',
      vendorName: r.visitor_vendor_name ?? '',
      approvalType: 'recurring',
      approvedAt: null,
      scheduledFor: null,
      photoUrl: null,
      idType: null,
      idLast4: null,
      refNumber: null,
    });
  });

  return items;
}
