import React, { useEffect, useState } from 'react';

import {
  tileVisits, GUARD_TILE_KEYS, VISITOR_TILE_KEYS, type GuardTileKey,
} from '../../lib/guardTiles';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import { PANEL_SPEC } from '../../lib/dashboardColumns';
import type { ReportVisit } from '../../lib/reportRow';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import DashboardPanel from '../../components/DashboardPanel';
import DashboardTile from '../../components/DashboardTile';
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

  // The card itself is components/DashboardTile — the same file the HOD board
  // renders (client instruction, 2026-08-16: the two views must not look like
  // different applications). The tile's label IS the panel's heading
  // (PANEL_SPEC), so the two can never say different things about the same list.
  const renderTile = (key: GuardTileKey, compact: boolean) => (
    <DashboardTile
      key={key}
      label={PANEL_SPEC[key].heading}
      value={drill[key].length}
      icon={TILE_ICONS[key]}
      ring={TILE_RING[key]}
      active={tile === key}
      loading={visitsLoading}
      compact={compact}
      onSelect={() => setTile(key)}
    />
  );

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
      <DashboardPanel icon={TILE_ICONS[tile]} heading={spec.heading} count={rows.length} loading={visitsLoading}>
        <DashboardVisitorTable
          rows={rows}
          columns={spec.columns}
          loading={visitsLoading}
          empty={spec.empty}
          now={clock}
          initialsOf={initialsOf}
          onOpen={setDetailVisit}
        />
      </DashboardPanel>

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
