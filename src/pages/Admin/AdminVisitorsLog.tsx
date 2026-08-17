import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import VisitorsLogFilters from './VisitorsLogFilters';
import AdminTablePagination from './AdminTablePagination';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { filterLog, DEFAULT_LOG_FILTERS, type LogFilters } from '../../lib/visitorsLog';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import { exportToCsv } from '../../lib/exportUtils';
import { toReportRows, type ReportVisit } from '../../lib/reportRow';
import { istDateKey } from '../../lib/visitExpiry';

const LOG_LIMIT = 500;

// The Visitors Log: every visit, in any state, newest first.
//
// IT IS NOT REPORTS, and the difference is the control each one carries.
// Reports is a date-bounded document — it prints, it exports seventeen pinned
// columns, and `styles/print.css` fixes their widths. This is the register you
// open when somebody asks "did a Mr Mehta come in last week": the question is
// about a person, not a period, so the control is a search box and the window
// is simply the most recent rows. Giving each surface only the control that
// fits it is what stops them becoming two half-versions of one screen.
//
// READ-ONLY, like every admin visitor tab (client instruction, 2026-08-17).
// Clicking a row opens `VisitorDetails` with no approve/reject handlers, so it
// renders as a record rather than as a desk. The CSV export is a read too — and
// it goes through `toReportRows`, which is the redaction seam: raw `Visit` rows
// carry nested join objects, the base64 photo blob and the unmasked phone, and
// a CSV leaves the building.
//
// THE ROW CAP IS STATED ON SCREEN. A silent limit is the worst kind: an admin
// who searches for a visitor from two months ago and finds nothing would
// conclude the visit never happened, when the truth is that it fell outside the
// window. The footer says how many rows were loaded and points at Reports for
// anything older.

export default function AdminVisitorsLog(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const { visits, loading } = useAdminVisits({ kind: 'recent', limit: LOG_LIMIT });

  const [filters, setFilters] = useState<LogFilters>(DEFAULT_LOG_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  const rows = visits as ReportVisit[];
  const shown = useMemo(() => filterLog(rows, filters), [rows, filters]);

  // A filter that shrinks the set out from under the current page would
  // otherwise leave the reader on page 6 of 2, looking at an empty table and
  // concluding their search found nothing.
  useEffect(() => { setPage(1); }, [filters]);

  const pageRows = shown.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader
        title="Visitors Log"
        blurb="Every visit on record, newest first."
        action={
          <button
            type="button"
            disabled={shown.length === 0}
            onClick={() => exportToCsv(toReportRows(shown), `visitors-log-${istDateKey(now)}.csv`)}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {/* The count is on the button because the export takes the FILTERED
                set, not everything loaded — an admin who narrowed to one
                department must be able to see that before they send the file
                on. */}
            Export {shown.length === 0 ? 'CSV' : `${shown.length} rows`}
          </button>
        }
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
                ? 'No visit has been recorded yet.'
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
          Showing the {LOG_LIMIT} most recent visits. For anything older, use Reports, which
          takes a date range.
        </p>
      )}

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
