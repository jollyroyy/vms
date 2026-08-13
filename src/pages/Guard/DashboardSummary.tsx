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

// Today's summary: six tiles on a 3-wide grid, each answering a different
// question. See the `entered` vs `inside` note in lib/useGateStats.ts for why
// those two are not the same filter — `entered = inside + checkedOut` always
// holds, and a guard can eyeball that.
//
// Overstaying is not decoration and must not be dropped: it is the ONLY live
// mechanism for catching a check-out the gate forgot, since migration 067's
// sweep is installed but deliberately unscheduled.
//
// Pre-approved and Walk-ins Approved are NOT here (2026-08-13, client
// instruction). Both are segments of the Visitors surface, with their own KPI
// tile and their own list on that page; a second copy here was the same number
// on two screens behind two independent queries. See lib/dashboardDrill.ts.
//
// Row order is the gate's own order: what came in, what went out, who is left,
// then the three things still owed someone's attention.
export default function DashboardSummary({ stats, loading, activeKey, onDrill }: Props): React.ReactElement {
  return (
    <section>
      <h2 className="section-title mb-3">Today</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
