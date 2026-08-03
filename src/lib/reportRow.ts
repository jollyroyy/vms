// Mapper to convert Visit records to flat, PII-safe report rows.
// This file exists so the exported register cannot leak photo_data, photo_path,
// qr_token, any raw phone number, or any nested object — all are redacted here.

import type { Visit } from '../types/index';
import { maskPhone, maskIdProof } from './pii';
import { visitStatusLabel } from './visitStatusLabel';
import { approvalTimestamp } from './visitApproval';

export type ReportVisit = Visit & {
  actor?: { name: string; role: string } | null;
  actorAt?: string | null;
  approvedAt?: string | null;
};

export type ReportRow = Record<string, string>;

/** Private helper: format ISO timestamp to "en-IN" locale (date + time), or empty string if unparseable. */
function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN')}`;
}

/** Convert a single Visit to a flat ReportRow with exactly 15 string keys, in order. */
export function toReportRow(visit: ReportVisit, index: number): ReportRow {
  return {
    '#': String(index + 1),
    'Ref': visit.ref_number ?? '',
    'Name': visit.visitor?.full_name ?? '',
    'Vendor': visit.visitor?.vendor_name ?? '',
    'Phone': maskPhone(visit.visitor?.phone),
    'Department': visit.department?.name ?? '',
    'Host': visit.host?.full_name ?? '',
    'ID Proof': maskIdProof(visit.visitor?.id_type, visit.visitor?.id_last4),
    'Purpose': visit.purpose,
    // Resolved here rather than read straight off the row so the CSV and the
    // on-screen register can never disagree about when a visit was approved.
    'Approved At': formatStamp(approvalTimestamp(visit)),
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
export function toReportRows(visits: ReportVisit[]): ReportRow[] {
  return visits.map((v, i) => toReportRow(v, i));
}
