import React, { useEffect, useState } from 'react';
import { useGateStats } from '../../lib/useGateStats';
import { useInsideNow } from '../../lib/useInsideNow';
import { useRecentActivity } from '../../lib/useRecentActivity';
import type { ReportVisit } from '../../lib/reportRow';
import DashboardSummary from './DashboardSummary';
import DashboardActivity from './DashboardActivity';
import GuardInsideNow from './GuardInsideNow';
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
// summary (where do we stand) → optional inside-now drill-down → activity
// (what just happened). Search and Quick Actions were removed from the
// dashboard — starting a task lives in the console at /visitors, not here.
export default function GuardDashboard(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [insideOpen, setInsideOpen] = useState(false);
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const { stats, loading } = useGateStats(today);
  const { visits: insideVisits, loading: insideLoading } = useInsideNow(today);
  const { visits: recent, loading: recentLoading } = useRecentActivity(today);

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
        insideOpen={insideOpen}
        onToggleInside={() => setInsideOpen((prev) => !prev)}
      />

      {/* On-site detail, expanded from the Inside Now tile. Collapsed by
          default — the count is the headline, the roster is the drill-down. */}
      {insideOpen && (
        <GuardInsideNow loading={insideLoading} visits={insideVisits} onSelect={setDetailVisit} />
      )}

      <DashboardActivity
        visits={recent}
        loading={recentLoading}
        onSelect={(v) => setDetailVisit(v as ReportVisit)}
      />

      {detailVisit && (
        <VisitorDetails visit={detailVisit} viewerRole="guard" onClose={() => setDetailVisit(null)} />
      )}
    </div>
  );
}
