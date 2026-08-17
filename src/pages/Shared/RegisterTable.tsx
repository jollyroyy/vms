import React from 'react';
import type { Visit } from '../../types/index';
import { visitStatusLabel } from '../../lib/visitStatusLabel';
import { maskPhone, maskIdProof } from '../../lib/pii';
import { approvalTimestamp } from '../../lib/visitApproval';
import { visitOrigin, visitOriginLabel } from '../../lib/visitOrigin';
import type { ReportVisit } from '../../lib/reportRow';

// THE SEVENTEEN-COLUMN REGISTER TABLE, AND THERE IS ONLY ONE OF IT.
//
// `styles/print.css` pins the printed widths by `nth-child` — seventeen rules
// whose order must track the header array below — so a second copy of this table
// anywhere would be a second thing that has to be edited in lockstep with that
// block, and the failure mode is silent: the paper mis-columns, the screen looks
// fine. ONE surface renders it: `ReportsRegister` on `/reports`, for every role
// that can reach the page, on screen and on paper. `RegisterPrintSheet` was the
// second — the admin's paper-only copy on the Visitors Log tab — and it went
// with that tab when it merged into Reports on 2026-08-18, which is the whole
// point of the merge: one register, one print path, nothing to keep in step.
//
// The rows are drawn in `components/DashboardVisitorTable`'s language (client
// instruction, 2026-08-16) so a report and the board it was read off do not look
// like two products.

const STATUS_COLORS: Record<string, string> = {
  rejected: 'text-danger-600', checked_out: 'text-navy-300', checked_in: 'text-brand-600',
  approved: 'text-brand-600', walkin_approved: 'text-brand-600', pending_approval: 'text-warning-600',
};

// Rejected/approved statuses render as a full sentence ("Rejected by Jane (Host)") —
// CSS capitalize would upper-case every word ("By", "Host"), so only plain statuses get it.
const PLAIN_STATUS: Record<string, boolean> = {
  pending_approval: true, checked_in: true, checked_out: true, cancelled: true, no_show: true,
  expired: true, lapsed: true,
};

export const REGISTER_HEADERS = ['#', 'Ref', 'Photo', 'Visitor Name', 'Vendor', 'Phone',
  'Type of Visitor', 'Dept', 'Person to Meet', 'ID Proof', 'Purpose', 'Carrying',
  'Carrying Remarks', 'Approved', 'Check-in', 'Check-out', 'Status'];

// Carrying is two columns, not one — the flag is a yes/no fact the admin can
// scan down, the remarks are what the guard typed at the gate. Crushing them
// into one cell made "carried something, nothing written down" look identical
// to "carried nothing", and made the flag impossible to count.
const carryingFlag = (v: Visit): string => (v.carrying_material ? 'Yes' : 'No');

// `carrying_material` predates the free-text column, so rows written before it
// still only say *that* something was carried. Say so rather than showing a
// blank that reads as "nothing was carried".
const carryingRemarks = (v: Visit): string => {
  const remarks = v.carrying_remarks?.trim();
  if (remarks) return remarks;
  return v.carrying_material ? 'Not recorded' : '—';
};

const dateTime = (iso: string | null | undefined): React.ReactNode => {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    <>
      <span className="block">{d.toLocaleDateString('en-IN')}</span>
      <span className="block text-navy-500 dark:text-navy-400">{d.toLocaleTimeString('en-IN')}</span>
    </>
  );
};

const CELL = 'px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb]';

type Props = {
  rows: ReportVisit[];
  /** Rendered in place of the body when there is nothing to list. Omit on a
   *  print-only sheet, where an empty table needs no medallion. */
  empty?: React.ReactNode;
};

export default function RegisterTable({ rows, empty }: Props): React.ReactElement {
  return (
    <table className="register-table w-full text-sm tabular-nums">
      <thead>
        <tr className="table-head">
          {REGISTER_HEADERS.map((h) => (
            <th key={h} className="px-4 py-3 font-bold whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((v, i) => (
          <tr key={v.id} className="border-t border-surface-200/50 dark:border-white/[0.05] transition-colors hover:bg-brand-600/5">
            <td className={`${CELL} tabular-nums`}>{i + 1}</td>
            <td className="px-4 py-3 text-[11px] font-mono text-navy-500 dark:text-navy-400">{v.ref_number}</td>
            {/* Round, brand-ringed, and the same size as the board's face — a
                visitor is recognised the same way on both. */}
            <td className="px-4 py-3">
              {v.photo_url ? (
                <img src={v.photo_url} alt="Visitor photo" className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-500/25" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-100 dark:bg-white/[0.06] flex items-center justify-center text-navy-500 ring-1 ring-black/5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                </div>
              )}
            </td>
            <td className="px-4 py-3 font-medium text-navy-950 dark:text-white">{v.visitor?.full_name}</td>
            <td className={`${CELL} font-medium`}>{v.visitor?.vendor_name}</td>
            <td className={`${CELL} font-mono text-xs`}>{maskPhone(v.visitor?.phone)}</td>
            {/* Booked ahead or turned up unannounced (client instruction,
                2026-08-16), resolved through lib/visitOrigin.ts — the same
                inference the guard's board and the HOD's board make. */}
            <td className={`${CELL} font-medium whitespace-nowrap`}>{visitOriginLabel(visitOrigin(v))}</td>
            <td className={`${CELL} font-medium`}>{v.department?.name}</td>
            <td className={`${CELL} font-medium`}>{v.host?.full_name}</td>
            <td className={`${CELL} font-mono text-xs whitespace-nowrap`}>{maskIdProof(v.visitor?.id_type, v.visitor?.id_last4)}</td>
            <td className={`${CELL} font-medium capitalize`}>{v.purpose}</td>
            <td className="px-4 py-3 text-xs whitespace-nowrap">
              <span className={v.carrying_material ? 'font-bold text-accent-700 dark:text-accent-300' : 'text-[#9aa3af] dark:text-[#b7c0cb]'}>
                {carryingFlag(v)}
              </span>
            </td>
            <td className={`${CELL} text-xs max-w-[14rem]`}>
              <span className="block truncate" title={v.carrying_remarks ?? undefined}>{carryingRemarks(v)}</span>
            </td>
            <td className={`${CELL} text-xs font-medium tabular-nums whitespace-nowrap`}>{dateTime(approvalTimestamp(v))}</td>
            <td className={`${CELL} text-xs font-medium tabular-nums whitespace-nowrap`}>{dateTime(v.checked_in_at)}</td>
            <td className={`${CELL} text-xs font-medium tabular-nums whitespace-nowrap`}>{v.checked_out_at ? dateTime(v.checked_out_at) : v.exit_verified === false ? 'Auto-closed' : '—'}</td>
            <td className={`px-4 py-3 font-medium ${PLAIN_STATUS[v.status] ? 'capitalize' : ''} ${STATUS_COLORS[v.status] ?? 'text-navy-500'}`}>{visitStatusLabel(v)}</td>
          </tr>
        ))}
        {rows.length === 0 && empty && (
          <tr><td colSpan={REGISTER_HEADERS.length} className="px-4 py-10">{empty}</td></tr>
        )}
      </tbody>
    </table>
  );
}
