import React, { useEffect, useState } from 'react';
import { useGateStats } from '../../lib/useGateStats';
import { useTodayVisits } from '../../lib/useTodayVisits';
import type { ReportVisit } from '../../lib/reportRow';
import type { DrillKey } from '../../lib/dashboardDrill';
import DashboardSummary from './DashboardSummary';
import DashboardDrilldown from './DashboardDrilldown';
import VisitorDetails from '../../components/VisitorDetails';

// The guard's home screen: situational awareness, not a workspace.
//
// Everything that CHANGES a visit's state lives in the console at /visitors.
// This page used to duplicate that — it carried its own inside-list, its own
// expected-list and its own realtime subscription while /visitors rendered the
// same things again, so a guard had two competing home screens and no way to
// tell which was authoritative. The split is now: read here, act there.
//
// Layout order is deliberate and matches how a shift actually starts:
// summary (where do we stand) → the drill-down the guard just opened. Search,
// Quick Actions and the Recent Activity feed were all removed — starting a task
// lives in the console at /visitors, and every row the activity feed listed was
// already one click away inside the tile that counts it.
//
// Every KPI tile drills down IN PLACE. Clicking a count expands the visits
// behind it right below the summary; clicking the same tile again collapses it.
// None of them navigate away — reading the board should never cost you the
// board. (Acting on a visit still happens in /visitors; opening a card here
// gives a read-only VisitorDetails.)
export default function GuardDashboard(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [drillKey, setDrillKey] = useState<DrillKey | null>(null);
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const { stats, loading } = useGateStats(today);
  const { visits: todayVisits, loading: visitsLoading } = useTodayVisits(today);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-7 animate-fade-in pb-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Security Gate</h1>
          <p className="page-subtitle">
            {clock.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="glass-chip !py-1.5 !px-3.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          <span className="text-sm font-bold text-navy-700 tabular-nums">
            {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <DashboardSummary
        stats={stats}
        loading={loading}
        activeKey={drillKey}
        onDrill={(key) => setDrillKey((prev) => (prev === key ? null : key))}
      />

      {/* Collapsed by default — the count is the headline, the cards are the
          drill-down. Re-clicking the open tile closes it. */}
      {drillKey && (
        <DashboardDrilldown
          drillKey={drillKey}
          loading={visitsLoading}
          visits={todayVisits}
          onSelect={setDetailVisit}
          onClose={() => setDrillKey(null)}
        />
      )}

      {/* No Recent Activity feed. Every one of its rows was already reachable
          by clicking the tile above that counts it, and a scrolling list of
          things that already happened is not something a guard acts on. */}

      {detailVisit && (
        <VisitorDetails visit={detailVisit} viewerRole="guard" onClose={() => setDetailVisit(null)} />
      )}
    </div>
  );
}
