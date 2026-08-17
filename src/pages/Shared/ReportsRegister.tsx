import React from 'react';
import ReportsPrintHeader from './ReportsPrintHeader';
import RegisterTable from './RegisterTable';
import type { ReportVisit } from '../../lib/reportRow';

type Props = {
  /** The rows after the department filter — what is printed and counted. */
  shown: ReportVisit[];
  /** Every row loaded, so the filter chip can say how many are hidden. */
  total: number;
  activeDept: { id: string; name: string; code?: string | null } | null;
  rangeLabel: string;
  from: string;
  to: string;
  loading: boolean;
};

// The visitor register on `/reports`, extracted out of Reports.tsx.
//
// IT IS NOT RENDERED FOR AN ADMIN (client instruction, 2026-08-17: the same
// information is already on the Visitors Log tab). That tab carries the same rows
// through the same `toReportRows` redaction seam, has its own CSV export and — as
// of the same instruction — its own department filter and printout, so for an
// admin this section was a second place to read one register, and the two could
// only ever drift.
//
// IT IS STILL RENDERED FOR AN HOD AND FOR STAFF, and that is not an oversight.
// `/admin/visitors-log` is admin-only (ROLE_ROUTES), so those two roles have no
// other surface that lists a visit at all; dropping the table for everyone would
// have left them a page holding a date picker and nothing else. This page was
// already role-split exactly this way — the charts and the four download cards
// above it are admin-only, for the mirror reason.

export default function ReportsRegister(
  { shown, total, activeDept, rangeLabel, from, to, loading }: Props,
): React.ReactElement {
  return (
    <>
      <div className="print-only">
        <ReportsPrintHeader rangeLabel={`Register — ${rangeLabel}`} entryCount={shown.length} />
      </div>

      <section>
        <div className="revamp-section-head mb-4 no-print">
          <span className="revamp-section-rule" aria-hidden="true" />
          <h2 className="section-title">Register — {rangeLabel}</h2>
          <span className="glass-chip text-navy-500 dark:text-navy-400 tabular-nums">({shown.length} entries)</span>
          {activeDept && (
            <span className="glass-chip text-navy-500">
              Filtered to {activeDept.name} · {total - shown.length} hidden
            </span>
          )}
        </div>
        {loading ? (
          <div className="card p-6 space-y-3 no-print">{[1, 2, 3].map((i) => <div key={i} className="h-8 skeleton" />)}</div>
        ) : (
          <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm print:p-0 print:border-0 print:bg-transparent print:shadow-none">
            <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] print:border-0">
              <div className="overflow-x-auto print:overflow-visible">
                <RegisterTable
                  rows={shown}
                  empty={
                    <div className="revamp-empty">
                      <div className="revamp-empty-medallion">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                      </div>
                      <p className="revamp-empty-title">No entries in this range</p>
                      <p className="revamp-empty-sub">{activeDept
                        ? `No ${activeDept.name} visits between ${from} and ${to}`
                        : `No visits between ${from} and ${to}`}</p>
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Only the table header repeats across pages, so the register needs an
          explicit end-of-report block — otherwise a printed copy has no way to
          show it is complete and no place to sign it off. */}
      <div className="print-only print-footer">
        <p className="print-meta">End of register · {shown.length} {shown.length === 1 ? 'entry' : 'entries'} · {rangeLabel}</p>
        <p className="print-meta">Confidential — contains personal data. Phone and ID numbers are masked.</p>
        <div className="print-signature"><span className="print-meta">Verified by</span></div>
      </div>
    </>
  );
}
