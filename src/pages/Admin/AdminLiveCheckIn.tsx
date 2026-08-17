import React, { useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import LiveCheckInTabs, { type LiveCheckInLane } from './LiveCheckInTabs';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { expectedLane, insideLane, departedLane, pendingLane } from '../../lib/adminLiveCheckIn';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import type { ReportVisit } from '../../lib/reportRow';

// The admin's Live Check-In tab — a read-only mirror of the guard's Entry &
// Exit tab (`pages/Guard/GuardLiveQueue.tsx`), for the same audience Reports
// already serves: someone who needs to SEE the gate's day, never act on it.
//
// NOTHING HERE WRITES. `useAdminVisits` never exports a mutation (see the
// comment at the top of that file), and clicking a row opens `VisitorDetails`
// with no approve/reject/check-in/check-out handlers — a record, not a desk.
//
// PRE-REGISTRATION IS FOLDED IN HERE (client instruction, 2026-08-18) as the
// Expected lane, and the tab is now the gate's whole day in one place: who is
// due, who is in, who has gone, who is waiting on an answer. The old tab's
// ranged history, its three KPI tiles, its filter row and its pager are gone —
// see `expectedLane` for which of those were saying something this screen or
// Reports was already saying.
//
// THIS TAB IS A ROSTER AND CARRIES NO KPI TILES (2026-08-17). It had four; two
// restated the lane badges directly below them, one restated the Dashboard tab's
// headline figure, and the fourth was a count with no list to open. The full
// reasoning is in the header of `lib/adminLiveCheckIn.ts`. The split that
// survives is worth stating: the Dashboard tab reads today's SHAPE — the hourly
// flow, the purpose split, the host ranking — and this tab reads today's
// PEOPLE, by name, in the four states they can be in. Neither screen states the
// other's numbers.
//
// ONE FETCH FEEDS ALL THREE LANES, so a badge and the list it opens can never
// disagree — `guardTiles.ts`'s rule, applied here as it is on the guard board.
// The `today` window carries the open statuses UNBOUNDED (see
// `useAdminVisits`), which is what puts a visitor still inside from last night
// in the Inside lane and a walk-in registered at 23:50 in the Awaiting
// Approval lane rather than dropping both at midnight.

export default function AdminLiveCheckIn(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const { visits, loading } = useAdminVisits({ kind: 'today' });
  const [lane, setLane] = useState<LiveCheckInLane>('inside');
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  const expected = useMemo(() => expectedLane(visits, now) as ReportVisit[], [visits, now]);
  const inside = useMemo(() => insideLane(visits) as ReportVisit[], [visits]);
  const departed = useMemo(() => departedLane(visits, now) as ReportVisit[], [visits, now]);
  const pending = useMemo(() => pendingLane(visits) as ReportVisit[], [visits]);

  const LANE_ROWS: Record<LiveCheckInLane, ReportVisit[]> = {
    expected, inside, departed, pending,
  };
  const rows = LANE_ROWS[lane];

  // Each lane states its own fact. "Nobody is inside", "nobody has left yet"
  // and "every request has been answered" are three different claims and must
  // not share one sentence — the same rule the guard's two lanes follow.
  const LANE_EMPTY: Record<LiveCheckInLane, string> = {
    expected: 'Nobody is booked in for the rest of today.',
    inside: 'Nobody is inside right now.',
    departed: 'Nobody has checked out yet today.',
    pending: 'Every walk-in request has been answered.',
  };
  const empty = LANE_EMPTY[lane];

  // The Awaiting Approval lane has no arrival to print — that is what it means
  // to be waiting — so it swaps the two arrival stamps for the moment the
  // request was raised, which is the figure the delay is measured from. An
  // em dash under "Checked In" on every row would state "not recorded" where
  // the truth is "has not happened yet".
  //
  // The Expected lane has no arrival either, and no Type of Visitor column: a
  // pre-approval is the only thing that can be on it, so the word would print
  // on every line and say nothing. It shows the SLOT instead, which is the
  // figure "are they late?" is read off.
  const columns = lane === 'pending'
    ? [COLUMN.name, COLUMN.host, COLUMN.department, COLUMN.purpose, COLUMN.requested, COLUMN.status]
    : lane === 'expected'
      ? [COLUMN.name, COLUMN.host, COLUMN.department, COLUMN.purpose, COLUMN.scheduled, COLUMN.status]
      : [COLUMN.name, COLUMN.origin, COLUMN.host, COLUMN.department,
         COLUMN.checkedIn, COLUMN.checkedOut, COLUMN.status];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* No blurb (client instruction, 2026-08-18). The four lanes below name
          themselves and carry their own counts, so a line describing them was
          the screen explaining itself to itself — the same argument that took
          the page headings off the guard and HOD dashboards. */}
      <AdminPageHeader title="Live Check-In" scope="live" />

      <LiveCheckInTabs
        lane={lane}
        onSelect={setLane}
        counts={{
          expected: expected.length,
          inside: inside.length,
          departed: departed.length,
          pending: pending.length,
        }}
        loading={loading}
      />

      {/* COLUMN.checkedOut already prints an em dash for a null checked_out_at
          (see `stamp` in dashboardColumns.ts) — a visitor still on site reads
          "—", never a blank cell, with no override needed here. */}
      <DashboardVisitorTable
        rows={rows}
        columns={columns}
        loading={loading}
        empty={empty}
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
