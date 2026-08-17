import React, { useMemo, useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import LineChart from '../../components/charts/LineChart';
import DonutChart from '../../components/charts/DonutChart';
import UtilizationRows from '../../components/charts/UtilizationRows';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import VisitorDetails from '../../components/VisitorDetails';
import AdminDashboardKpis from './AdminDashboardKpis';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { useVisitFeedback } from '../../lib/useVisitFeedback';
import { adminKpis, hourlyFlow, purposeSplit, topHosts, lobbyFeed } from '../../lib/adminDashboard';
import { COLUMN } from '../../lib/dashboardColumns';
import { chartColor } from '../../lib/chartPalette';
import { initialsOf } from '../../lib/initials';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';

// The admin Dashboard: six KPI tiles, a visitor-flow line, a purpose donut, the
// lobby feed and today's busiest hosts.
//
// ONE QUERY FEEDS ALL SIX PANELS. Every figure on this screen is derived from
// the same array of visits by a pure function in `lib/adminDashboard.ts`, so
// the Visitors Today tile and the flow chart underneath it cannot disagree
// about how many people came in — which is exactly the defect that made the
// guard dashboard's tile read 1 while its panel listed five.
//
// THE WINDOW IS TWO DAYS, not one. The first tile states a change against
// yesterday, and a comparison needs both sides of itself in the same fetch;
// pulling yesterday separately would let the two halves of one sentence be
// loaded at different moments and describe different sets.
//
// NOTHING HERE WRITES. The admin's visitor access is read-only (2026-08-17):
// the feed opens `VisitorDetails` because reading a record is the point, and
// that modal is passed no approve/reject handlers, so it renders as a record
// and not as a desk.

export default function AdminDashboard(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const yesterday = istDateKey(new Date(now.getTime() - 86400000));
  const today = istDateKey(now);

  const { visits, loading } = useAdminVisits({ kind: 'range', from: yesterday, to: today });
  const { feedback } = useVisitFeedback();
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  const kpis = useMemo(() => adminKpis(visits, feedback, now), [visits, feedback, now]);
  const flow = useMemo(() => hourlyFlow(visits, now), [visits, now]);
  const purposes = useMemo(() => purposeSplit(visits, now), [visits, now]);
  const hosts = useMemo(() => topHosts(visits, now), [visits, now]);
  const feed = useMemo(() => lobbyFeed(visits, now) as ReportVisit[], [visits, now]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* No page heading, the same call the guard and HOD boards make: the
          sidebar item just clicked already says "Dashboard", and this screen
          has no toolbar for a heading row to anchor. */}
      <AdminDashboardKpis kpis={kpis} loading={loading} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="xl:col-span-2">
          <ChartCard
            heading="Visitor Flow — Today"
            about="Arrivals per hour, counted at the moment the gate checked each visitor in."
          >
            <LineChart points={flow} seriesLabel="Visitors" color={chartColor(0)}
                       emptyMessage="Nobody has checked in yet today." />
          </ChartCard>
        </div>

        <ChartCard
          heading="Visit Purpose"
          about="Today's arrivals by the purpose recorded on the visit."
        >
          <DonutChart slices={purposes} unit="arrivals"
                      emptyMessage="No arrivals to break down yet." />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <ChartCard
            heading="Live Lobby Feed"
            about="Everyone the gate admitted today, most recent arrival first."
          >
            <DashboardVisitorTable
              rows={feed}
              columns={[COLUMN.name, COLUMN.host, COLUMN.purpose, COLUMN.origin, COLUMN.status]}
              loading={loading}
              empty="No visitor has come through the gate today."
              now={now}
              initialsOf={initialsOf}
              onOpen={(v) => setSelected(v)}
            />
          </ChartCard>
        </div>

        <ChartCard
          heading="Top Hosts Today"
          about="Hosts ranked by how many visitors they received today."
        >
          <UtilizationRows
            headers={['Host', 'Share', 'Visitors']}
            unit="visitors"
            rows={hosts.map((h, i) => ({
              label: h.label,
              value: h.value,
              // The lead is the host's FACE, not just a rank — a name on its
              // own is a lookup, a face is a person recognised at a glance.
              // The rank survives as a small chip ahead of it (never inside
              // the `<img>`'s alt, which stays empty: the name is printed
              // immediately beside it, so the alt would only duplicate it).
              lead: (
                <span className="shrink-0 flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-[11px] tabular-nums text-navy-500 text-right">
                    {i + 1}
                  </span>
                  {h.avatarUrl ? (
                    <img
                      src={h.avatarUrl}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-brand-500/25"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400
                                     text-[11px] font-semibold flex items-center justify-center">
                      {initialsOf(h.label)}
                    </span>
                  )}
                </span>
              ),
            }))}
            emptyMessage="No arrivals today, so there is nobody to rank."
          />
        </ChartCard>
      </div>

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
