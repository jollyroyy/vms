import React from 'react';
import type { DrillKey } from '../../lib/dashboardDrill';
import { TILES } from './dashboardTiles';

type Props = {
  drillKey: DrillKey;
  value: number;
  loading: boolean;
  expanded: boolean;
  index: number;
  onDrill: () => void;
};

// One KPI card. Icon plate on the left, then the number, the label and the
// qualifier stacked beside it, with a chevron on the trailing edge.
//
// The chevron is the reason the plate layout is worth the extra width: it says
// "this opens", and every tile here DOES open — clicking expands the matching
// visits directly underneath. It is not a link and must never become one. These
// used to navigate to /visitors?tab=…, which threw the guard off the board they
// were reading to answer a question about it. Reading the board should never
// cost you the board.
//
// The qualifier line ("Today" / "Right now") is doing real work, not decorating:
// half these tiles are cumulative counts of the day and half are live counts of
// this instant, and a guard glancing at two numbers side by side has no other
// way to tell which is which.
export default function DashboardTile({
  drillKey, value, loading, expanded, index, onDrill,
}: Props): React.ReactElement {
  const t = TILES[drillKey];

  return (
    <button
      type="button"
      onClick={onDrill}
      aria-expanded={expanded}
      style={{ animationDelay: `${index * 0.04}s`, ['--kpi-tint' as string]: t.tint }}
      className={`gate-tile kpi-tile ${drillKey === 'inside' ? 'gate-tile-primary' : ''} ${expanded ? 'gate-tile-active' : ''} animate-slide-up`}
    >
      <span className={`kpi-plate ${t.tone}`}>{t.icon}</span>

      <span className="min-w-0 flex-1">
        <span className={`gate-tile-value block ${t.tone}`}>{loading ? '—' : value}</span>
        <span className="gate-tile-label block">{t.label}</span>
        <span className="block text-[10px] text-navy-400 dark:text-navy-400 mt-0.5 leading-snug">
          {t.hint}
        </span>
      </span>

      <svg className="kpi-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
