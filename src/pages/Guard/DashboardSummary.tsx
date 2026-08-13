import React from 'react';
import type { GateStats } from '../../lib/useGateStats';
import { DRILL_KEYS, type DrillKey } from '../../lib/dashboardDrill';
import DashboardTile from './DashboardTile';

type Props = {
  stats: GateStats;
  loading: boolean;
  activeKey: DrillKey | null;
  onDrill: (key: DrillKey) => void;
};

// Today's summary: eight tiles on a 4-wide grid, each answering a different
// question. See the `entered` vs `inside` note in lib/useGateStats.ts for why
// those two are not the same filter — `entered = inside + checkedOut` always
// holds, and a guard can eyeball that.
//
// The reference design showed six tiles and no Pre-approved, Walk-ins Approved
// or Overstaying. All three stayed. Overstaying in particular is not
// decoration: it is the ONLY live mechanism for catching a check-out the gate
// forgot, and migration 067's sweep that would otherwise catch it is installed
// but deliberately unscheduled. Dropping the tile would leave nothing watching.
//
// Pre-approved and Walk-ins Approved are likewise two populations arriving by
// two routes (booked ahead vs. approved at the gate), each with its own console
// page. Merging them back into one "Expected" tile would hide the split the
// guard acts on. Keep the keys separate.
//
// Row order is the gate's own order: what came in, what went out, who is left,
// then the four things still owed someone's attention.
export default function DashboardSummary({ stats, loading, activeKey, onDrill }: Props): React.ReactElement {
  return (
    <section>
      <h2 className="section-title mb-3">Today</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {DRILL_KEYS.map((key, i) => (
          <DashboardTile
            key={key}
            drillKey={key}
            value={stats[key]}
            loading={loading}
            expanded={activeKey === key}
            index={i}
            onDrill={() => onDrill(key)}
          />
        ))}
      </div>
    </section>
  );
}
