import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminRangeBar from './AdminRangeBar';
import VisitorsLogFilters from './VisitorsLogFilters';
import AdminTablePagination from './AdminTablePagination';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import RegisterPrintSheet from '../Shared/RegisterPrintSheet';
import { filterLog, DEFAULT_LOG_FILTERS, type LogFilters } from '../../lib/visitorsLog';
import { ALL_DEPTS, deptOptions } from '../../lib/reportsDeptFilter';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import { exportToCsv } from '../../lib/exportUtils';
import { toReportRows, type ReportVisit } from '../../lib/reportRow';
import { istDateKey } from '../../lib/visitExpiry';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';

const LOG_LIMIT = 500;

// The Visitors Log: every visit, in any state, newest first — WITHIN A CHOSEN
// WINDOW (client instruction, 2026-08-17: historical tabs must say they are
// historical and carry a date-wise + 7/30/60/90-day + 1-year filter). It used
// to be the 500 most recent visits with no control at all; that made the tab
// itself the boundary an admin had to feel out by trial, rather than a period
// they chose.
//
// IT IS THE ADMIN'S REGISTER OUTRIGHT since 2026-08-17 (client instruction:
// the same information was on Reports, so the table there is gone for this
// role). What came across with it is everything that made Reports a document —
// the DEPARTMENT FILTER, the seventeen-column PRINTOUT and the CSV — and all
// three read the same `filterLog` output, so the sheet in an admin's hand, the
// file they mail on and the rows they are looking at cannot describe different
// sets. Reports keeps the charts, the four standing CSV reports, and the
// register itself for an HOD and for staff, who cannot reach this tab.
//
// READ-ONLY, like every admin visitor tab (client instruction, 2026-08-17).
// Clicking a row opens `VisitorDetails` with no approve/reject handlers, so it
// renders as a record rather than as a desk. The CSV export is a read too — and
// it goes through `toReportRows`, which is the redaction seam: raw `Visit` rows
// carry nested join objects, the base64 photo blob and the unmasked phone, and
// a CSV leaves the building.
//
// THE ROW CAP IS STATED ON SCREEN, but the advice attached to it changed with
// the range control: a silent limit within a chosen window is still the worst
// kind of surprise, but the fix is no longer "go to Reports" — this tab now
// takes a date range itself, so the honest advice is to narrow the one already
// on screen.

export default function AdminVisitorsLog(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => istDateKey(now), [now]);

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [endDate, setEndDate] = useState<string>(today);
  const range = useMemo(() => computeDateRange(preset, endDate), [preset, endDate]);

  const { visits, loading } = useAdminVisits({ kind: 'range', from: range.from, to: range.to, limit: LOG_LIMIT });

  const [filters, setFilters] = useState<LogFilters>(DEFAULT_LOG_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  const rows = visits as ReportVisit[];
  const shown = useMemo(() => filterLog(rows, filters), [rows, filters]);

  // A filter OR a range change that shrinks the set out from under the current
  // page would otherwise leave the reader on page 6 of 2, looking at an empty
  // table and concluding their search found nothing.
  useEffect(() => { setPage(1); }, [filters, preset, endDate]);

  const pageRows = shown.slice((page - 1) * pageSize, page * pageSize);

  // THE PAPER REGISTER IS MOUNTED ONLY WHILE PRINTING. Keeping it in the tree
  // permanently would put every filtered row in the DOM twice — up to 500 rows
  // of it — and a screen reader has no `@media print`, so it would read the whole
  // register a second time after the table. `.print-only` hides it visually; it
  // does not stop it existing. So: arm on click, render, print on the next frame
  // (the sheet must be laid out before the dialog opens), unmount on `afterprint`.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return undefined;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const raf = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener('afterprint', done);
      cancelAnimationFrame(raf);
    };
  }, [printing]);

  // What the file and the printed letterhead are called. A filtered register
  // that prints without naming its department is a document that quietly omits
  // most of the window — the same rule Reports' own label followed.
  const deptName = filters.department === ALL_DEPTS
    ? null
    : deptOptions(rows).find((d) => d.id === filters.department)?.name ?? null;
  const rangeLabel = `${deptName ? `${deptName} · ` : ''}${range.from} to ${range.to}`;
  const fileStem = `visitors-log-${deptName ? `${deptName.replace(/\s+/g, '-').toLowerCase()}-` : ''}${range.from}_${range.to}`;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* SCREEN ONLY. `styles/print.css` lays out one thing — the seventeen-column
          register — so everything that is a control rather than a record has to be
          out of the print tree: the range bar, the filter row, the eight-column
          lookup table and the pagination would otherwise print as a wall of
          furniture around a table that is not the register. */}
      <div className="no-print">
      <AdminPageHeader
        title="Visitors Log"
        blurb="Every visit in the selected window, newest first."
        scope="historical"
        action={
          <>
            {/* Both act on the FILTERED set, and the filename and the letterhead
                say which set that was: a CSV and a sheet of paper leave the
                building and cannot carry the screen's pickers with them, so the
                window and any department have to be stated on the artefact
                itself. Disabled at zero rather than producing a header row with
                nothing under it — an empty file is indistinguishable from a
                broken export until somebody opens it. */}
            <button
              type="button"
              disabled={shown.length === 0}
              onClick={() => exportToCsv(toReportRows(shown), `${fileStem}.csv`)}
              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
            <button
              type="button"
              disabled={shown.length === 0}
              onClick={() => setPrinting(true)}
              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" />
              </svg>
              Print Register
            </button>
          </>
        }
      />

      <AdminRangeBar
        preset={preset}
        endDate={endDate}
        today={today}
        onPresetChange={setPreset}
        onEndDateChange={setEndDate}
        noun="visits"
      />

      <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] shadow-glow-sm overflow-hidden">
        <VisitorsLogFilters rows={rows} filters={filters} onChange={setFilters} />

        <div className="p-4">
          <DashboardVisitorTable
            rows={pageRows}
            columns={[
              COLUMN.name, COLUMN.origin, COLUMN.host, COLUMN.department,
              COLUMN.purpose, COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status,
            ]}
            loading={loading}
            empty={
              filters.query.trim() === '' && filters.status === 'all' && filters.origin === 'all'
                ? 'No visit was recorded in this window.'
                : 'No visit matches these filters.'
            }
            now={now}
            initialsOf={initialsOf}
            onOpen={(v) => setSelected(v)}
          />
        </div>

        <AdminTablePagination
          totalItems={shown.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {!loading && rows.length >= LOG_LIMIT && (
        <p className="text-xs text-navy-500 mt-3">
          The selected window hit the {LOG_LIMIT}-row cap — narrow the date range above to
          see every visit in it.
        </p>
      )}

      </div>

      {/* THE PAPER REGISTER. Every filtered row, not the open page — see
          RegisterPrintSheet. It is the artefact that used to come off /reports,
          and it is the reason the Print button above is not a dead control. */}
      {printing && (
        <div className="print-only">
          <RegisterPrintSheet rows={shown} rangeLabel={rangeLabel} />
        </div>
      )}

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
