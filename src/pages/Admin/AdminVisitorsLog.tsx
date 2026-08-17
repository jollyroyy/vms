import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminRangeBar from './AdminRangeBar';
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
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';

const LOG_LIMIT = 500;

// The Visitors Log: every visit, in any state, newest first — WITHIN A CHOSEN
// WINDOW (client instruction, 2026-08-17: historical tabs must say they are
// historical and carry a date-wise + 7/30/60/90-day + 1-year filter). It used
// to be the 500 most recent visits with no control at all; that made the tab
// itself the boundary an admin had to feel out by trial, rather than a period
// they chose.
//
// IT IS NOT REPORTS, and the difference is still the control each one carries,
// only now they overlap more than they used to. Reports prints, exports
// seventeen pinned columns, and `styles/print.css` fixes their widths — a
// document. This is a register with a search box on top of its range: the
// question is usually about a person ("did a Mr Mehta come in last month"),
// found by narrowing a window rather than reading a fixed document.
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

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader
        title="Visitors Log"
        blurb="Every visit in the selected window, newest first."
        scope="historical"
        action={
          <button
            type="button"
            disabled={shown.length === 0}
            onClick={() => exportToCsv(toReportRows(shown), `visitors-log-${range.from}_${range.to}.csv`)}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {/* The count is on the button because the export takes the FILTERED
                set, not everything loaded — an admin who narrowed to one
                department must be able to see that before they send the file
                on. The filename carries the range instead: a CSV leaves the
                building and cannot carry the screen's date picker with it, so
                the window it came from has to be stated in the name itself. */}
            Export {shown.length === 0 ? 'CSV' : `${shown.length} rows`}
          </button>
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

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
