import React, { useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminPreRegistrationKpis from './AdminPreRegistrationKpis';
import AdminPreRegFilters, { DEFAULT_FILTERS, type PreRegFilters } from './AdminPreRegFilters';
import AdminTablePagination from './AdminTablePagination';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { isPreRegistration, filterPreRegistrations, preRegKpis } from '../../lib/preRegistration';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import type { ReportVisit } from '../../lib/reportRow';

const PAGE_SIZE_DEFAULT = 10;

// Visitors booked in advance — the admin's read-only view of every
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
// ONE FETCH, `useAdminVisits({ kind: 'recent', limit: 500 })` — the admin's
// one visit query (see lib/useAdminVisits.ts) — narrowed client-side to
// pre-registrations by `isPreRegistration`. The KPI tiles count that narrowed
// set BEFORE the filter bar touches it, so "Invites Sent" answers "how many
// bookings", never "how many for the host currently selected". The filter bar
// and pagination then operate on the same narrowed set the table renders.
export default function AdminPreRegistration(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const { visits, loading } = useAdminVisits({ kind: 'recent', limit: 500 });

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
  // change is simpler and safer than clamping in the pager alone.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const changeFilters = (next: PreRegFilters) => { setFilters(next); setPage(1); };

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const [selected, setSelected] = useState<ReportVisit | null>(null);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader title="Pre-Registration" blurb="Visitors booked in advance." />

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
      </div>

      {/* Read-only: no approve/reject/check-in handler is ever passed, so the
          popup renders as a record, never as a desk (2026-08-17 instruction). */}
      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
