// The HOD dashboard's KPI board: four tiles, and the rows behind whichever one
// is pressed (client instruction, 2026-08-16 — every KPI must be drillable).
//
// It is the guard board's markup, not a lookalike: the tiles are the shared
// components/DashboardTile and the panel is the shared
// components/DashboardVisitorTable, both of which the guard dashboard renders
// from the same files. The client asked for the two views not to "look
// different style wise, since they are part of same /vms app" — sharing the
// components makes that true by construction rather than true until the next
// edit to one of them.
//
// It follows the guard board's one rule: the number IS the length of the list
// the tile opens, both taken from lib/hodTiles.ts. Pressing a tile swaps the
// panel below; the panel is never empty, because a board with nothing under it
// spends a row of the screen telling you to press something.
//
// The rows are DISPLAY-ONLY. Approving or declining happens on the walk-in
// desk, where the request's reason box and the audit trail live — a dashboard
// that could clear a visitor would be a second route to the same write with
// nothing saying which was authoritative.
import React from 'react';
import type { Visit } from '../../types/index';
import type { ReportVisit } from '../../lib/reportRow';
import { HOD_TILE_KEYS, HOD_TILE_META, HOD_PANEL_SPEC, type HodTileKey } from '../../lib/hodTiles';
import DashboardTile from '../../components/DashboardTile';
import DashboardPanel from '../../components/DashboardPanel';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import GlanceHeader from '../../components/GlanceHeader';
import HodDashboardCharts from './HodDashboardCharts';

type Props = {
  tiles: Record<HodTileKey, Visit[]>;
  /** Today's department visits — what the chart band is derived from. It is the
   *  same array the tiles are sliced out of, never a second fetch. */
  dayVisits: Visit[];
  selected: HodTileKey;
  onSelect: (key: HodTileKey) => void;
  loading: boolean;
  now: Date;
  initialsOf: (name: string | null | undefined) => string;
  onOpen: (visit: ReportVisit) => void;
};

export default function HodKpiBoard({
  tiles, dayVisits, selected, onSelect, loading, now, initialsOf, onOpen,
}: Props): React.ReactElement {
  const spec = HOD_PANEL_SPEC[selected];
  const rows = tiles[selected] as ReportVisit[];

  return (
    <>
      {/* The window, said once, so no tile below has to repeat it (client
          instruction, 2026-08-17). The caption names what this board actually
          spans rather than leaving "Today" to be read literally: two of the
          seven lanes carry rows from earlier days on purpose — On Site Now is
          live, and Awaiting Walk-in Approval is deliberately not day-bounded,
          because a request raised at 23:50 is still somebody standing at
          reception at 00:05. */}
      <GlanceHeader caption="Your department's visitors today — plus anyone still on site, and any walk-in still waiting on you." />

      {/* Seven since check-ins and check-outs joined the board (client
          instruction, 2026-08-17), and NEVER SEVEN ACROSS (2026-08-18, client
          report: the tile labels could not be read).
          `2xl:grid-cols-7` was arithmetic that did not survive contact with the
          longest label. A tile spends 104px before a letter is drawn — `px-5`
          each side plus the 48px icon plate and its `gap-4` — so at 2xl, where
          the content column beside the sidebar is ~1230px, seven tiles left
          about 58px of text column. `break-words` then does what it is for and
          splits INSIDE the word, so "Pre-Approvals Given" came out stacked as
          "Pre-/Approva/ls Given": four lines, one of them not a word.
          Four across is the widest this board goes. It fills 4+3 with no tile
          stranded alone on a line, and at every step the longest label
          ("Awaiting Walk-in Approval") wraps only between words. One column on
          a phone for the same reason — two 172px tiles put the label back under
          70px — which is also the ladder KpiTile already climbs on the Visitors
          rail. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {HOD_TILE_KEYS.map((key) => (
          <DashboardTile
            key={key}
            label={HOD_PANEL_SPEC[key].heading}
            value={tiles[key].length}
            icon={HOD_TILE_META[key].icon}
            ring={HOD_TILE_META[key].ring}
            active={selected === key}
            loading={loading}
            onSelect={() => onSelect(key)}
          />
        ))}
      </div>

      <div id="hod-kpi-drill">
        <DashboardPanel
          icon={HOD_TILE_META[selected].icon}
          heading={spec.heading}
          count={rows.length}
          loading={loading}>
          <DashboardVisitorTable
            rows={rows}
            columns={spec.columns}
            loading={loading}
            empty={spec.empty}
            now={now}
            initialsOf={initialsOf}
            onOpen={onOpen}
          />
        </DashboardPanel>
      </div>

      {/* The shape of the day, under the people in it. Derived from the same
          rows the tiles are counting — no second query, so the flow chart and
          the Checked In tile cannot disagree about how many came through. */}
      <HodDashboardCharts visits={dayVisits} now={now} />
    </>
  );
}
