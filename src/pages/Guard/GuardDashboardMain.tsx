import React, { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';
import { useGateStats } from '../../lib/useGateStats';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import ArrivalQueueTable from './ArrivalQueueTable';
import IdVerificationCard from './IdVerificationCard';
import WatchlistAlertBanner from './WatchlistAlertBanner';
import KpiDrilldownSheet, { type TileSpec } from './KpiDrilldownSheet';
import VisitorDetails from '../../components/VisitorDetails';

// Guard Dashboard — reference screen 1 ("Guard Console" main overview).
//
// Exact framing per the approved attachment:
//   row 1  — four KPI tiles: Expected Today / Checked In / In Premises /
//            Pending Check-out, each with an icon in a ring + label + numeral
//   row 2  — left: "Live Arrival Queue" card (see ArrivalQueueTable);
//            right: "ID Verification" card (see IdVerificationCard)
//   row 3  — red WATCHLIST ALERT banner (see WatchlistAlertBanner)
//
// All counts come from useGateStats / useTodayVisits (single subscription),
// so the tiles and the table can never disagree. KPI tiles are drillable:
// clicking a tile opens the stacked visitor sheet (KpiDrilldownSheet) right
// below the tiles; tap a card to open its full visitor details popup.

const TILE_ICONS = {
  expected:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  checked: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  inside:
    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 0 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  pending: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
};

// Expected Today = approved + walkin_approved scheduled today (incl. overdue)
// minus anyone already through the gate for that slot; Checked In and In
// Premises come straight from the stats; Pending Check-out = checked_in rows
// past their plausible visit window or simply still inside at end of day.
export default function GuardDashboardMain(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  // Drilldown: which KPI tile is expanded into the stacked visitor list sheet.
  const [drillTile, setDrillTile] = useState<string | null>(null);
  // The popup the header comment promises: tapping a card in the drill-down
  // sheet closes the sheet and opens that visit's full details.
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);
  // Which queue row the guard has selected for ID verification. Starts on the
  // first awaiting visitor and switches live as rows are clicked — the
  // ID Verification panel renders this exact visitor.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const today = istDateKey(clock);
  const { stats, loading } = useGateStats(today);
  const { visits, loading: visitsLoading } = useTodayVisits(today);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // The queue row of the reference screen: visitors expected at the gate —
  // approved or walk-in approved visitors who have NOT checked in yet,
  // ordered by scheduled time (walk-ins without a slot sort by created_at).
  // Checked-in visitors are deliberately excluded — they are already through
  // the gate and appear in the full Live Queue tab instead.
  const queue = visits
    .filter((v) => (v.status === 'approved' || v.status === 'walkin_approved') && !v.checked_in_at)
    .sort((a, b) => (a.scheduled_for ?? a.created_at).localeCompare(b.scheduled_for ?? b.created_at));

  // ID Verification target: the visitor the guard clicked in the queue, or
  // the first awaiting visitor if nothing is selected. It re-reads the fresh
  // subscription row on every render so the panel can never show a stale
  // status (e.g. immediately after a check-in).
  const liveSelected = selectedId ? (visits.find((v) => v.id === selectedId) ?? null) : null;
  const idTarget =
    liveSelected ??
    visits.find((v) => v.status === 'approved' && !v.checked_in_at) ??
    visits.find((v) => v.status === 'walkin_approved' && !v.checked_in_at) ??
    visits.find((v) => v.status === 'checked_in') ??
    null;

  const tiles: TileSpec[] = [
    {
      key: 'expected',
      label: 'Expected Today',
      count: stats.awaitingApproval + stats.overdue,
      ring: 'border-brand-500/30 text-brand-500',
      icon: TILE_ICONS.expected,
    },
    {
      key: 'checked',
      label: 'Checked In',
      count: stats.entered,
      ring: 'border-success-500/40 text-success-500',
      icon: TILE_ICONS.checked,
    },
    {
      key: 'inside',
      label: 'In Premises',
      count: stats.inside,
      ring: 'border-brand-400/30 text-brand-400',
      icon: TILE_ICONS.inside,
    },
    {
      key: 'pending',
      label: 'Pending Check-out',
      count: stats.overstaying,
      ring: 'border-warning-400/40 text-warning-400',
      icon: TILE_ICONS.pending,
    },
  ];

  const initialsOf = (name: string | null | undefined) =>
    ((name ?? 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U');

  const statusPill = (visit: ReportVisit) => {
    if (visit.checked_in_at) {
      return { label: 'CHECKED IN', cls: 'bg-success-600/15 text-success-500 border-success-500/30' };
    }
    if (visit.status === 'approved') {
      return { label: 'PRE-REGISTERED', cls: 'bg-brand-600/15 text-brand-400 border-brand-500/30' };
    }
    return { label: 'WAITING', cls: 'bg-warning-500/15 text-warning-400 border-warning-400/30' };
  };

  const timeOf = (visit: ReportVisit) => {
    if (visit.checked_in_at) {
      return new Date(visit.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    if (visit.scheduled_for) {
      return new Date(visit.scheduled_for).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return new Date(visit.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const watchlistCount = visits.filter((v) => v.visitor?.is_blacklisted === true).length;

  // Each tile drills into the visits that make up its number. The mapping
  // mirrors useGateStats: `expected` = approved/walk-in slots, `checked` =
  // anyone through the gate today, `inside` = still on premises, `pending` =
  // still inside with a departure window.
  const tileVisits: Record<string, ReportVisit[]> = {
    expected: visits.filter((v) => v.status === 'pending_approval' || v.status === 'approved' || v.status === 'walkin_approved'),
    checked: visits.filter((v) => v.status === 'checked_in' || v.status === 'checked_out' || !!v.checked_in_at),
    inside: visits.filter((v) => v.status === 'checked_in' && !v.checked_out_at),
    pending: visits.filter((v) => v.status === 'checked_in' && !v.checked_out_at && v.expected_departure),
  };

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Row 1 — KPI tiles. Every tile drills into the visitors behind its
          number: click opens the stacked visitor sheet right below the tiles.
          The active tile gets a subtle blue highlight; click again or press
          Escape to collapse. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const active = drillTile === t.key;
          const rows = tileVisits[t.key] ?? [];
          return (
            <button
              key={t.key}
              type="button"
              aria-expanded={active}
              onClick={() => setDrillTile(active ? null : t.key)}
              className={`rounded-2xl border px-5 py-5 flex items-center gap-4 shadow-glow-sm text-left w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow ${
                active
                  ? 'bg-brand-600/10 dark:bg-brand-500/15 border-brand-500/40 ring-1 ring-brand-500/30'
                  : 'bg-surface-100/60 dark:bg-white/[0.03] border-surface-200/60 dark:border-white/[0.07]'
              }`}>
              <span className={`shrink-0 w-12 h-12 rounded-full border ${t.ring} flex items-center justify-center`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-navy-500 dark:text-navy-600">{t.label}</span>
                <span className="block font-display text-[2rem] leading-tight font-medium tracking-tight tabular-nums text-navy-950 dark:text-white">{loading ? '—' : t.count}</span>
                <span className="block text-[11px] font-medium text-brand-500 dark:text-brand-400 mt-0.5 opacity-80">
                  {active ? '\u25b2 Click to close' : rows.length > 0 ? '\u25bc Click to view' : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Drilldown sheet — stacked visitor cards for the selected KPI tile. */}
      {drillTile && (
        <KpiDrilldownSheet
          tile={tiles.find((t) => t.key === drillTile)!}
          visits={tileVisits[drillTile] ?? []}
          loading={visitsLoading}
          initialsOf={initialsOf}
          statusPill={statusPill}
          timeOf={timeOf}
          onOpen={(v) => {
            setDrillTile(null);
            setDetailVisit(v);
          }}
          onClose={() => setDrillTile(null)}
        />
      )}

      {/* Row 2 — Live Arrival Queue + ID Verification */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        <div className="xl:col-span-3 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-brand-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 0 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
            <h2 className="font-display text-h2 text-navy-950 dark:text-white">Live Arrival Queue</h2>
          </div>

          <ArrivalQueueTable
            queue={queue}
            loading={visitsLoading}
            initialsOf={initialsOf}
            statusPill={statusPill}
            timeOf={timeOf}
            selectedId={liveSelected?.id ?? null}
            onOpen={(v) => {
              // Dashboard queue rows never open a popup: clicking a row only
              // switches the right-hand ID Verification panel to that visitor.
              setSelectedId(v.id);
              setDrillTile(null);
            }}
          />

          <div className="mt-4 flex justify-center">
            <Link
              to="/guard/live-queue"
              className="text-sm font-semibold text-brand-500 hover:text-brand-400 flex items-center gap-1 transition-colors">
              View Full Queue
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </div>

        <IdVerificationCard idTarget={idTarget} initialsOf={initialsOf} />
      </div>

      {/* Row 3 — watchlist alert banner */}
      <WatchlistAlertBanner watchlistCount={watchlistCount} />

      {detailVisit && (
        <VisitorDetails
          visit={detailVisit}
          viewerRole="guard"
          onClose={() => setDetailVisit(null)}
        />
      )}

    </div>
  );
}
