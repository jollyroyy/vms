import React, { useEffect, useState } from 'react';

import { tileVisits, type GuardTileKey } from '../../lib/guardTiles';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import { formatStamp } from '../../lib/formatDate';
import ArrivalQueueTable from './ArrivalQueueTable';
import IdVerificationCard from './IdVerificationCard';
import WatchlistAlertBanner from './WatchlistAlertBanner';
import KpiDrilldownSheet, { type TileSpec } from './KpiDrilldownSheet';
import VisitorDetails from '../../components/VisitorDetails';
import DenyEntryConfirm from './DenyEntryConfirm';
import SuccessToast from '../../components/SuccessToast';
import { useDenyEntry } from '../../lib/useDenyEntry';

// Guard Dashboard — reference screen 1 ("Guard Console" main overview).
//
// Exact framing per the approved attachment:
//   row 1  — four KPI tiles: Expected Today / Checked In / In Premises /
//            Overstaying, each with an icon in a ring + label + numeral
//   row 2  — left: "Expected Today" card (see ArrivalQueueTable);
//            right: "ID Verification" card (see IdVerificationCard)
//   row 3  — red WATCHLIST ALERT banner (see WatchlistAlertBanner)
//
// Every count on this page is the LENGTH OF THE LIST THAT TILE OPENS —
// lib/guardTiles.ts holds one predicate per tile and both the number and the
// drill-down panel are derived from it, over the single useTodayVisits
// subscription. They cannot disagree, because there is only one of them. KPI
// tiles are drillable:
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
  // Deny Entry lives in its own hook (lib/useDenyEntry.ts) — see the note
  // there; the dashboard's tiles, queue and drill-down never touch its state.
  const deny = useDenyEntry(() => setSelectedId(null));
  const today = istDateKey(clock);
  const { visits, loading: visitsLoading } = useTodayVisits(today);

  // ONE source for every tile: the count IS the length of the list the tile
  // opens. These used to come from two different queries under two different
  // rules (useGateStats for the number, an inline filter for the cards), which
  // is why a tile reading 1 could expand into five cards. See lib/guardTiles.ts.
  const drill = tileVisits(visits, clock);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // "Expected Today" — approved or walk-in-approved visitors who have NOT
  // checked in yet, ordered by scheduled time (walk-ins without a slot sort by
  // created_at). Checked-in visitors are deliberately excluded: they are
  // through the gate and belong to the Entry & Exit tab.
  //
  // Named "Live Arrival Queue" until 2026-08-15 (client instruction), which was
  // wrong twice over — the same class of mismatch that renamed Inside Now.
  // Nothing here is LIVE (these are bookings, most of them hours away) and
  // nobody is in a QUEUE (a queue is people waiting at the gate; the one thing
  // every row here shares is that the person is absent, which is exactly why
  // they have no check-in time).
  //
  // The name now matches the KPI tile above it ON PURPOSE, because this is
  // literally the same predicate as `TILE_FILTER.expected` in lib/guardTiles.ts.
  // They are the same list at two altitudes — a number to glance at, and the
  // rows with names and times — and giving them one name is what says so. If
  // the predicate ever changes, change it in guardTiles.ts and derive this from
  // it rather than editing the filter below to match.
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
      count: drill.expected.length,
      ring: 'border-brand-500/30 text-brand-500',
      icon: TILE_ICONS.expected,
    },
    {
      key: 'checked',
      label: 'Checked In',
      count: drill.checked.length,
      ring: 'border-success-500/40 text-success-500',
      icon: TILE_ICONS.checked,
    },
    {
      key: 'inside',
      label: 'In Premises',
      count: drill.inside.length,
      ring: 'border-brand-400/30 text-brand-400',
      icon: TILE_ICONS.inside,
    },
    {
      // "Overstaying", not "Pending Check-out". The number here has always been
      // `isOverstaying` — everyone inside is pending check-out, so the old label
      // described the In Premises tile beside it and left this one's real
      // meaning, a check-out the gate probably forgot, unsaid.
      key: 'overstaying',
      label: 'Overstaying',
      count: drill.overstaying.length,
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

  // formatStamp, not a local toLocaleTimeString: it pins IST and prints the
  // DATE as well whenever the instant is not today. This list is not
  // date-bounded, so a bare time on it said when but not whether that when was
  // today. See lib/formatDate.ts.
  const timeOf = (visit: ReportVisit) =>
    formatStamp(visit.checked_in_at ?? visit.scheduled_for ?? visit.created_at, clock);

  const watchlistCount = visits.filter((v) => v.visitor?.is_blacklisted === true).length;

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Row 1 — KPI tiles. Every tile drills into the visitors behind its
          number: click opens the stacked visitor sheet right below the tiles.
          The active tile gets a subtle blue highlight; click again or press
          Escape to collapse. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const active = drillTile === t.key;
          const rows = drill[t.key as GuardTileKey] ?? [];
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
                <span className="block font-display text-[2rem] leading-tight font-medium tracking-tight tabular-nums text-navy-950 dark:text-white">{visitsLoading ? '—' : t.count}</span>
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
          visits={drill[drillTile as GuardTileKey] ?? []}
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

      {/* Row 2 — Expected Today + ID Verification */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        <div className="xl:col-span-3 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-brand-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 0 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
            <h2 className="font-display text-h2 text-navy-950 dark:text-white">Expected Today</h2>
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
        </div>

        <IdVerificationCard idTarget={idTarget} initialsOf={initialsOf} onDeny={deny.open} />
      </div>

      {/* Row 3 — watchlist alert banner */}
      <WatchlistAlertBanner watchlistCount={watchlistCount} />

      <SuccessToast message={deny.toast} onDismiss={deny.dismissToast} />

      {deny.error && (
        <p className="rounded-xl border border-danger-500/30 bg-danger-600/10 px-4 py-3 text-sm text-danger-400">{deny.error}</p>
      )}

      {deny.target && (
        <DenyEntryConfirm
          visit={deny.target}
          busy={deny.busy}
          onClose={deny.cancel}
          onConfirm={(reason) => { void deny.confirm(deny.target!, reason); }}
        />
      )}

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
