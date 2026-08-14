import React, { useEffect, useState } from 'react';
import { useGateStats } from '../../lib/useGateStats';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import type { DrillKey } from '../../lib/dashboardDrill';
import DashboardSummary from './DashboardSummary';
import DashboardDrilldown from './DashboardDrilldown';
import DashboardActivity from './DashboardActivity';
import DashboardQuickActions from './DashboardQuickActions';
import VisitorDetails from '../../components/VisitorDetails';

// The guard's home screen: situational awareness, and the two ways to start a
// job that are not already in the sidebar.
//
// Everything that CHANGES a visit's state still lives in the console at
// /visitors. This page used to duplicate that — its own inside-list, its own
// expected-list, its own realtime subscription, all mirrored at /visitors — so
// a guard had two competing home screens and no way to tell which was
// authoritative. Quick Actions do not reopen that: they navigate to the console,
// they do not act here.
//
// Layout order matches how a shift is actually read: where do we stand (the
// tiles) → the tile you just opened → what has happened so far, beside what you
// might want to start.
//
// Every KPI tile drills down IN PLACE. Clicking a count expands the visits
// behind it right below the summary; clicking the same tile again collapses it.
// None of them navigate away — reading the board should never cost you the
// board.
//
// The drill-down's CARDS open nothing (client instruction, 2026-08-13 — the
// Details control went from the stacked card on both this page and /visitors).
// The Recent Activity feed's rows still open a read-only VisitorDetails: a feed
// entry is a one-line "X entered at 09:12" with no facts on it beyond a name
// and a time, so without somewhere to go it would be a row that says too little
// and does nothing. A drill-down card already carries everything the sheet
// would have shown.
export default function GuardDashboard(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [drillKey, setDrillKey] = useState<DrillKey | null>(null);
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);

  // IST, not UTC. `toISOString().slice(0, 10)` is the UTC date, so between
  // 00:00 and 05:30 IST this page asked for yesterday: a visit booked for 01:00
  // IST was filed under the previous day and was invisible on the morning it
  // was due. Same rule as everywhere else — see lib/visitExpiry.ts.
  const today = istDateKey(clock);
  const { stats, loading } = useGateStats(today);
  const { visits: todayVisits, loading: visitsLoading } = useTodayVisits(today);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-7 animate-fade-in pb-4">
      {/* No gate name and no "Gate Status: Operational" chip, both of which the
          reference design carried. There is no gates table, no per-guard gate
          assignment and nothing that monitors a gate's health, so either would
          be a hardcoded claim the system cannot stand behind — and a status
          chip that is green because it is always green is worse than no chip.
          The clock is real and the Live pill means the subscriptions are on. */}
      {/* No "Dashboard" heading (client instruction, 2026-08-13). The sidebar
          item the guard just clicked is already lit and already says it; the
          page restating its own name spent the widest line on screen on the one
          fact the guard cannot be in doubt about. Everything else on this line
          stays — the date, the Live pill and the clock are all things only the
          page can tell them. */}
      <header>
        <div className="revamp-greeting flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="revamp-greeting-eyebrow">Gate Console</p>
            <p className="revamp-greeting-title">
              {clock.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="revamp-greeting-sub">Everything at the entrance, in one glance.</p>
          </div>
          <span className="flex items-center gap-3">
            <span className="glass-chip !py-1 !px-2.5 !gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-success-700">Live</span>
            </span>
            <span className="font-bold text-navy-700 dark:text-navy-200 text-lg tabular-nums">
              {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
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
          onClose={() => setDrillKey(null)}
        />
      )}

      {/* Activity is DERIVED from todayVisits — the same array the tiles above
          count, no second query and no second subscription. That is what makes
          it safe to show a feed beside the counts: the two cannot tell
          different stories about the same day. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2">
          <DashboardActivity
            visits={todayVisits}
            loading={visitsLoading}
            onSelect={setDetailVisit}
          />
        </div>
        <DashboardQuickActions />
      </div>

      <p className="flex items-start gap-2.5 rounded-xl px-4 py-3 bg-surface-100/70 dark:bg-white/[0.04] border border-surface-200/70 dark:border-white/[0.06] text-xs text-navy-500 dark:text-navy-400">
        <svg className="w-4 h-4 shrink-0 mt-px text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25h1.5v5.25m-.75-9h.008v.008H12V7.5zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {/* Deliberately not "all statistics are for today only". Open visits are
            never date-bounded: someone who came in at 21:00 last night and has
            not left is on the premises NOW and is counted. Saying otherwise
            would have a guard mistrust the one number they must not. */}
        <span>
          Counts update in real time. Figures cover today&rsquo;s activity, plus anyone still
          inside from an earlier day.
        </span>
      </p>

      {detailVisit && (
        <VisitorDetails visit={detailVisit} viewerRole="guard" onClose={() => setDetailVisit(null)} />
      )}
    </div>
  );
}
