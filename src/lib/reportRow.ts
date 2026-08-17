// Mapper to convert Visit records to flat, PII-safe report rows.
// This file exists so the exported register cannot leak photo_data, photo_path,
// qr_token, any raw phone number, or any nested object — all are redacted here.

import type { Visit } from '../types/index';
import type { VisitActorFields } from './visitActors';
// The EXPORT variants of the two redactions: same rule, ASCII fill. A ReportRow
// only ever becomes a CSV, and a bullet does not survive Excel's encoding guess
// — see the note in lib/pii.ts.
import { maskPhoneForExport, maskIdProofForExport } from './pii';
import { visitStatusLabel } from './visitStatusLabel';
import { approvalTimestamp } from './visitApproval';
import { visitOrigin, visitOriginLabel } from './visitOrigin';
import { approverLabel } from './visitApprover';

export type ReportVisit = Visit & VisitActorFields;

export type ReportRow = Record<string, string>;

/** Private helper: format ISO timestamp to "en-IN" locale (date + time), or empty string if unparseable. */
function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN')}`;
}

export type ReportRowOptions = {
  /** Include the "Approved By" column. Off for a department-scoped viewer: an
   *  HOD exporting their own register is exporting their own decisions. */
  withApprover?: boolean;
};

/** Convert a single Visit to a flat ReportRow, in column order. */
export function toReportRow(
  visit: ReportVisit, index: number, opts: ReportRowOptions = {},
): ReportRow {
  return {
    '#': String(index + 1),
    'Ref': visit.ref_number ?? '',
    'Visitor Name': visit.visitor?.full_name ?? '',
    'Vendor': visit.visitor?.vendor_name ?? '',
    'Phone': maskPhoneForExport(visit.visitor?.phone),
    // Booked ahead or turned up unannounced. In the CSV unconditionally: a
    // register that cannot be filtered by arrival route cannot answer the one
    // question a month of visits is usually opened with.
    'Type of Visitor': visitOriginLabel(visitOrigin(visit)),
    'Department': visit.department?.name ?? '',
    'Person to Meet': visit.host?.full_name ?? '',
    'ID Proof': maskIdProofForExport(visit.visitor?.id_type, visit.visitor?.id_last4),
    'Purpose': visit.purpose,
    // Resolved here rather than read straight off the row so the CSV and the
    // on-screen register can never disagree about when a visit was approved.
    'Approved At': formatStamp(approvalTimestamp(visit)),
    // The approver's name AND their department — see lib/visitApprover.ts for
    // why the second half is there and why an HOD's export omits the pair.
    ...(opts.withApprover ? { 'Approved By': approverLabel(visit, { withDepartment: true }) } : {}),
    'Checked In At': formatStamp(visit.checked_in_at),
    'Checked Out At': formatStamp(visit.checked_out_at),
    // Two columns, not one. The flag and the description answer different
    // questions — "did this visitor bring anything in?" is filterable and
    // sortable; "what exactly?" is free text a guard typed at the gate. They
    // used to be crushed into a single cell, which meant a carried-material
    // visit with no description was indistinguishable from a blank one, and no
    // one could count how many visits carried material at all.
    'Carrying': visit.carrying_material ? 'Yes' : 'No',
    'Carrying Remarks': visit.carrying_remarks?.trim() ?? '',
    'Status': visitStatusLabel(visit),
  };
}

/** Convert an array of Visits to an array of ReportRows, numbered 1-indexed. */
export function toReportRows(visits: ReportVisit[], opts: ReportRowOptions = {}): ReportRow[] {
  return visits.map((v, i) => toReportRow(v, i, opts));
}
