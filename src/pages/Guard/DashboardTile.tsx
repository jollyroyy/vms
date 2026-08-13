import React from 'react';
import type { DrillKey } from '../../lib/dashboardDrill';
import { TILES } from './dashboardTiles';
import KpiTile from '../../components/KpiTile';

type Props = {
  drillKey: DrillKey;
  value: number;
  loading: boolean;
  expanded: boolean;
  index: number;
  onDrill: () => void;
};

// The dashboard's KPI card. All the look lives in the shared KpiTile — this
// file exists so the dashboard keeps a DrillKey-shaped API while the Visitors
// rail (VisitorKpiRail) drives the same card from its own spec.
export default function DashboardTile({
  drillKey, value, loading, expanded, index, onDrill,
}: Props): React.ReactElement {
  return (
    <KpiTile
      spec={TILES[drillKey]}
      value={value}
      loading={loading}
      expanded={expanded}
      index={index}
      onDrill={onDrill}
    />
  );
}