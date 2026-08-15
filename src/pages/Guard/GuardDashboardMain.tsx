import React, { useEffect, useState } from 'react';

import {
  tileVisits, GUARD_TILE_KEYS, VISITOR_TILE_KEYS, type GuardTileKey,
} from '../../lib/guardTiles';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import { PANEL_SPEC } from '../../lib/dashboardColumns';
import type { ReportVisit } from '../../lib/reportRow';
import DashboardVisitorTable from './DashboardVisitorTable';
import { TILE_ICONS, TILE_RING, sortForTile } from './dashboardTileMeta';
import VisitorDetails from '../../components/VisitorDetails';

// Guard Dashboard — the whole board, on one screen.
//
//   row 1  — the gate's four tiles: Expected Today / Checked In / In Premises /
//            Overstaying
//   row 2  — the five lanes moved off the Visitors tab (2026-08-15, client
//            instruction): All Visitors / Pending Approval / Approved Walk-ins /
//            Declined by Host / Entry Refused at the Gate, rendered compact
//   row 3  — ONE list, whose HEADING AND COLUMNS ARE THE SELECTED TILE'S
//
// THE PANEL'S HEADING IS DYNAMIC (client instruction, 2026-08-15). It was a
// fixed "Expected Today" table sitting beside a drill-down sheet that rendered
// the other six tiles as stacked cards — so the same rows had two layouts
// depending on which number you pressed, and the heading was wrong for six of
// the seven. Press "Checked In" and the panel now says Checked In and grows a
// Checked In column; press Overstaying and it grows an Overstaying By column.
// The specs live in lib/dashboardColumns.ts, one per tile.
//
// A TILE'S COUNT IS THE LENGTH OF THE LIST IT OPENS. There is no second rule —
// `drill[key].length` is the number and `drill[key]` is the panel, both out of
// lib/guardTiles.ts. That is what this board's 2026-08-14 rebuild fixed and it
// survives the tile count going from four to nine.
//
// THE BOARD IS READ-ONLY. The ID Verification card and its Verify ID / Deny
// Entry writes were removed 2026-08-15 (client instruction); check-in starts on
// the Pre-Registered board and refusal is gone from the app. "Dashboard reads,
// Console acts" now has no exceptions.

export default function GuardDashboardMain(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  // Which tile the panel below is showing. Never null — the board always has a
  // list under it, and an empty frame with "pick a tile" in it would be a whole
  // row of screen spent on an instruction. Defaults to the lane a guard opens
  // this page for.
  const [tile, setTile] = useState<GuardTileKey>('expected');
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);
  const today = istDateKey(clock);
  const { visits, loading: visitsLoading } = useTodayVisits(today);

  // ONE source for every tile: the count IS the length of the list the tile
  // opens. These used to come from two different queries under two different
  // rules (useGateStats for the number, an inline filter for the cards), which
  // is why a tile reading 1 could expand into five cards. See lib/guardTiles.ts.
  const drill = tileVisits(visits, clock);
  const spec = PANEL_SPEC[tile];
  const rows = sortForTile(drill[tile], tile);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const initialsOf = (name: string | null | undefined) =>
    ((name ?? 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U');

  const renderTile = (key: GuardTileKey, compact: boolean) => {
    const active = tile === key;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        onClick={() => setTile(key)}
        className={`rounded-2xl border ${compact ? 'px-4 py-3.5 gap-3' : 'px-5 py-5 gap-4'} flex items-center shadow-glow-sm text-left w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow ${
          active
            ? 'bg-brand-600/10 dark:bg-brand-500/15 border-brand-500/40 ring-1 ring-brand-500/30'
            : 'bg-surface-100/60 dark:bg-white/[0.03] border-surface-200/60 dark:border-white/[0.07]'
        }`}>
        <span className={`shrink-0 rounded-full border ${TILE_RING[key]} flex items-center justify-center ${compact ? 'w-9 h-9' : 'w-12 h-12'}`}>
          <svg className={compact ? 'w-4.5 h-4.5' : 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={TILE_ICONS[key]} />
          </svg>
        </span>
        <span className="min-w-0">
          {/* The tile's label IS the panel's heading (PANEL_SPEC), so the two
              can never say different things about the same list. */}
          <span className={`block font-medium text-navy-500 dark:text-navy-600 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
            {PANEL_SPEC[key].heading}
          </span>
          <span className={`block font-display leading-tight font-medium tracking-tight tabular-nums text-navy-950 dark:text-white ${compact ? 'text-[1.5rem]' : 'text-[2rem]'}`}>
            {visitsLoading ? '—' : drill[key].length}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Row 1 — the gate's own board. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {GUARD_TILE_KEYS.map((k) => renderTile(k, false))}
      </div>

      {/* Row 2 — the lanes that came off the Visitors tab, on one compact line
          (client instruction). Compact rather than full-size because these are
          the board's secondary questions; the shape and the interaction are
          identical, so a guard learns the card once. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {VISITOR_TILE_KEYS.map((k) => renderTile(k, true))}
      </div>

      {/* Row 3 — the one list. Heading and columns both follow the tile. */}
      <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-brand-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={TILE_ICONS[tile]} />
            </svg>
          </span>
          <h2 className="font-display text-h2 text-navy-950 dark:text-white">{spec.heading}</h2>
          <span className="text-sm font-semibold tabular-nums text-navy-700">
            {visitsLoading ? '' : rows.length}
          </span>
        </div>

        <DashboardVisitorTable
          rows={rows}
          columns={spec.columns}
          loading={visitsLoading}
          empty={spec.empty}
          now={clock}
          initialsOf={initialsOf}
          onOpen={setDetailVisit}
        />
      </div>

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
