// Builds the guard's check-in candidate list: today's approved visits plus the
// recurring visitors due today, filtered by the search box and department
// picker. Pure — extracted from CheckInPanel so the panel stays a state shell
// and this stays directly testable. The QR path builds the same MatchItem
// shape via qrMatchItem.ts; both must keep agreeing on field mapping.
import type { Department, Profile, RecurringVisit, Visit } from '../../types/index';
import { approvalTimestamp } from '../../lib/visitApproval';
import { isDueToday } from '../../lib/visitExpiry';
import { visitOrigin } from '../../lib/visitOrigin';
import type { MatchItem } from './checkInTypes';

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

/**
 * Flattens approved visits and today's recurring visitors into one ordered
 * candidate list.
 *
 * BROWSING and SEARCHING answer two different questions, and conflating them
 * was a real bug. With no query typed, this is the arrivals board: today's
 * approvals only, because a future booking sitting in that list reads exactly
 * like someone due now. But the moment a guard types a name or a phone number
 * they are asking "does this person have a pass at all?" — and the honest
 * answer spans every open approval, not just today's. Filtering the searchable
 * set to today meant that when every booking happened to be for a later day,
 * the guard searched a visitor who was standing in front of them holding a
 * valid pass and was told "No match found", then offered a walk-in request.
 *
 * A row that is not due today still comes back DISABLED (`dueToday: false`) —
 * findable, legible, and not checkable-in. Seeing the pass and being able to
 * honour it early are separate permissions.
 */
export function buildMatchItems(
  preApproved: PreApprovedVisit[],
  recurringToday: RecurringWithDept[],
  filters: MatchFilters,
  now: Date = new Date(),
): MatchItem[] {
  const items: MatchItem[] = [];
  const searching = filters.search.trim().length > 0;

  preApproved.forEach((v) => {
    const name = v.visitor?.full_name ?? '';
    const phone = v.visitor?.phone ?? '';
    if (!matches(name, phone, v.department_id, filters, v.ref_number)) return;
    const due = isDueToday(v, now);
    // Not due today: shown only when the guard is actively looking for it.
    if (!due && !searching) return;
    // lib/visitOrigin.ts, never a local status test — see the note on
    // ApprovalType in checkInTypes.ts for what the status test got wrong.
    const isWalkin = visitOrigin(v) === 'walk_in';
    items.push({
      id: `pre:${v.id}`,
      source: 'pre_approved',
      visitorName: name,
      visitorPhone: phone,
      departmentName: v.department?.name ?? '',
      departmentId: v.department_id,
      purpose: v.purpose,
      hostName: v.host?.full_name ?? '',
      vendorName: v.visitor?.vendor_name ?? '',
      approvalType: isWalkin ? 'walk_in' : 'pre_approved',
      approvedAt: approvalTimestamp(v),
      scheduledFor: v.scheduled_for,
      dueToday: due,
      status: v.status,
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
      departmentId: r.department_id,
      purpose: r.purpose,
      hostName: r.host?.full_name ?? '',
      vendorName: r.visitor_vendor_name ?? '',
      approvalType: 'recurring',
      approvedAt: null,
      scheduledFor: null,
      // recurringToday is already filtered to today by the caller, so a row
      // that reached here is by construction due now.
      dueToday: true,
      // No visit row exists yet — one is created at check-in.
      status: null,
      photoUrl: null,
      idType: null,
      idLast4: null,
      refNumber: null,
    });
  });

  return items;
}
