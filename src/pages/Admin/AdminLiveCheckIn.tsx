import React, { useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminKpiTile from '../../components/AdminKpiTile';
import LiveCheckInTabs, { type LiveCheckInLane } from './LiveCheckInTabs';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { liveCheckInKpis, insideLane, departedLane } from '../../lib/adminLiveCheckIn';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import { ICON_PEOPLE, ICON_CHECK_CIRCLE, ICON_EXIT, ICON_CALENDAR } from '../../lib/tileIcons';
import type { ReportVisit } from '../../lib/reportRow';

// The admin's Live Check-In tab — a read-only mirror of the guard's Entry &
// Exit tab (`pages/Guard/GuardLiveQueue.tsx`), for the same audience Reports
// already serves: someone who needs to SEE the gate's day, never act on it.
//
// NOTHING HERE WRITES. `useAdminVisits` never exports a mutation (see the
// comment at the top of that file), and clicking a row opens `VisitorDetails`
// with no approve/reject/check-in/check-out handlers — a record, not a desk.
//
// ONE FETCH FEEDS BOTH THE FOUR TILES AND THE TWO LANES. `liveCheckInKpis`,
// `insideLane` and `departedLane` all take the same `visits` array this page
// fetches once, so a tile's count and the lane it sits above can never
// disagree — `guardTiles.ts`'s rule, applied here exactly as it is on the
// guard board and the Badge Printing tab.

export default function AdminLiveCheckIn(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const { visits, loading } = useAdminVisits({ kind: 'today' });
  const [lane, setLane] = useState<LiveCheckInLane>('inside');
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  const kpis = useMemo(() => liveCheckInKpis(visits, now), [visits, now]);
  const inside = useMemo(() => insideLane(visits) as ReportVisit[], [visits]);
  const departed = useMemo(() => departedLane(visits, now) as ReportVisit[], [visits, now]);

  const rows = lane === 'inside' ? inside : departed;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader title="Live Check-In" blurb="Everyone the gate has handled today." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AdminKpiTile
          label="Arrived Today"
          value={String(kpis.arrivedToday)}
          icon={ICON_PEOPLE}
          tone="brand"
          loading={loading}
          caption="Came through the gate"
        />
        <AdminKpiTile
          label="Currently Inside"
          value={String(kpis.currentlyInside)}
          icon={ICON_CHECK_CIRCLE}
          tone="success"
          loading={loading}
          caption="Live in facility"
        />
        <AdminKpiTile
          label="Departed Today"
          value={String(kpis.departedToday)}
          icon={ICON_EXIT}
          tone="brand"
          loading={loading}
          caption="Checked out since the day began"
        />
        <AdminKpiTile
          label="Awaiting Approval"
          value={String(kpis.awaitingApproval)}
          icon={ICON_CALENDAR}
          tone="warning"
          loading={loading}
          captionToned={kpis.awaitingApproval > 0}
          caption="Walk-ins with no decision yet"
        />
      </div>

      <LiveCheckInTabs
        lane={lane}
        onSelect={setLane}
        counts={{ inside: inside.length, departed: departed.length }}
        loading={loading}
      />

      {/* COLUMN.checkedOut already prints an em dash for a null checked_out_at
          (see `stamp` in dashboardColumns.ts) — a visitor still on site reads
          "—", never a blank cell, with no override needed here. */}
      <DashboardVisitorTable
        rows={rows}
        columns={[COLUMN.name, COLUMN.origin, COLUMN.host, COLUMN.department, COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status]}
        loading={loading}
        // Each lane states its own fact — "nobody is inside" and "nobody has
        // checked out yet" are different claims and must not share one
        // sentence, the same rule the guard's two lanes follow.
        empty={lane === 'inside' ? 'Nobody is inside right now.' : 'Nobody has checked out yet today.'}
        now={now}
        initialsOf={initialsOf}
        onOpen={(v) => setSelected(v)}
      />

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
