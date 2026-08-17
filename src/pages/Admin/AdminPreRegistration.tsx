import React, { useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminPreRegistrationKpis from './AdminPreRegistrationKpis';
import AdminRangeBar from './AdminRangeBar';
import AdminPreRegFilters, { DEFAULT_FILTERS, type PreRegFilters } from './AdminPreRegFilters';
import AdminTablePagination from './AdminTablePagination';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { isPreRegistration, filterPreRegistrations, preRegKpis } from '../../lib/preRegistration';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';

const PAGE_SIZE_DEFAULT = 10;
const FETCH_CAP = 1000;

// Visitors booked in advance — the admin's read-only, HISTORICAL view of every
// pre-approval, whatever it went on to become (arrived, no-show, still
// waiting on its date).
//
// NO "Invite Visitor" BUTTON, though the client's mockup carries one. This
// system has no invite sender: `invitation_sent_at` (migration 085) is written
// by whatever process notifies a visitor today, not by a form on this screen,
// and the admin surface is read-only for visitor records by instruction
// (2026-08-17) besides. A button that opened nothing would be worse than no
// button.
//
// RANGED, NOT A FLAT 500-ROW FETCH (client instruction, 2026-08-17: every
// historical tab must say so and carry a date-wise + 7/30/60/90-day + 1-year
// filter). `useAdminVisits({ kind: 'range', ... })` windows the query
// server-side; `isPreRegistration` still narrows the result client-side to
// pre-approvals, because the window itself is booking-shaped, not
// pre-approval-shaped (see the note on `computeWindow` below). The KPI tiles
// count that narrowed set BEFORE the filter bar touches it, so "Invites Sent"
// answers "how many bookings in this period", never "how many for the host
// currently selected". The filter bar and pagination then operate on the same
// narrowed set the table renders.
//
// THE WINDOW IS ON WHEN A BOOKING WAS MADE (OR ARRIVED), NOT ON WHEN THE VISIT
// WAS SCHEDULED FOR. `useAdminVisits`'s range window is `created_at` OR
// `checked_in_at` inside the picked dates — there is no `scheduled_for` clause
// in that OR at all. So a pre-approval raised today for a visit next month is
// IN this window (created today), while a pre-approval raised six months ago
// for a visit tomorrow is OUT of it (created outside the window, not yet
// arrived). That is why every line of copy below says "made", never
// "happened" or "scheduled" — an admin reading "bookings from the last 30
// days" and expecting every visit landing in the next 30 days would be
// reading a promise this query does not keep.
export default function AdminPreRegistration(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => istDateKey(now), [now]);

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [endDate, setEndDate] = useState(today);
  const range = useMemo(() => computeDateRange(preset, endDate), [preset, endDate]);

  // `includeUpcoming` is what stops the range hiding the visitors this tab
  // exists to list. See the note above: the window is on when a booking was
  // MADE, so a pass raised forty days ago for next week is outside a
  // thirty-day range even though the visitor is still expected. Every open
  // pre-approval with a future slot is ORed in regardless of the dates.
  const { visits, loading } = useAdminVisits({
    kind: 'range', from: range.from, to: range.to, limit: FETCH_CAP, includeUpcoming: true,
  });

  const preRegistrations = useMemo(
    () => (visits as ReportVisit[]).filter(isPreRegistration),
    [visits],
  );
  const kpis = useMemo(() => preRegKpis(preRegistrations), [preRegistrations]);

  const [filters, setFilters] = useState<PreRegFilters>(DEFAULT_FILTERS);
  const filtered = useMemo(
    () => filterPreRegistrations(preRegistrations, filters, now),
    [preRegistrations, filters, now],
  );

  // A filter narrowing the set out from under the current page must not leave
  // the reader staring at an out-of-range page; resetting to 1 on every filter
  // change is simpler and safer than clamping in the pager alone. The range
  // controls narrow (or widen) the underlying fetch the exact same way a
  // filter narrows the client-side set, so they reset the page for the same
  // reason.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const changeFilters = (next: PreRegFilters) => { setFilters(next); setPage(1); };
  const changePreset = (next: RangePreset) => { setPreset(next); setPage(1); };
  const changeEndDate = (next: string) => { setEndDate(next); setPage(1); };

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const [selected, setSelected] = useState<ReportVisit | null>(null);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader
        title="Pre-Registration"
        blurb="Visitors booked in advance, over the period below."
        scope="historical"
      />

      <AdminRangeBar
        preset={preset}
        endDate={endDate}
        today={today}
        onPresetChange={changePreset}
        onEndDateChange={changeEndDate}
        noun="bookings made"
      />

      <AdminPreRegistrationKpis kpis={kpis} loading={loading} />

      <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-4">
        <AdminPreRegFilters rows={preRegistrations} filters={filters} onChange={changeFilters} />

        <DashboardVisitorTable
          rows={pageRows}
          columns={[COLUMN.name, COLUMN.department, COLUMN.host, COLUMN.purpose, COLUMN.scheduled,
            COLUMN.email, COLUMN.invited, COLUMN.status]}
          loading={loading}
          empty="No pre-registered visitors match these filters."
          now={now}
          initialsOf={initialsOf}
          onOpen={(v) => setSelected(v)}
        />

        <AdminTablePagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />

        {/* A silent cap is the specific failure this console refuses to ship
            (see useAdminVisits.ts): an admin who finds nothing concludes the
            booking never happened, when the truth is it fell past the 1000th
            row the fetch stopped at. `preRegistrations.length`, not
            `filtered.length` — the cap is on the fetch, before the filter bar
            or the pre-registration narrowing ever touch it, so this must
            check the same count the fetch itself produced. */}
        {preRegistrations.length >= FETCH_CAP && (
          <p className="text-xs text-warning-700 dark:text-warning-400 mt-3">
            Showing the first {FETCH_CAP} bookings in this window — narrow the date range to see the rest.
          </p>
        )}
      </div>

      {/* Read-only: no approve/reject/check-in handler is ever passed, so the
          popup renders as a record, never as a desk (2026-08-17 instruction). */}
      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
