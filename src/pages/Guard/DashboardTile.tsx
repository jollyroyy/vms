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
// The qualifier line is optional and several tiles do without it. Entries and
// Exits used to read "Today", which the section heading directly above the grid
// already says — the same word twice in one glance, buying nothing. Where a
// hint survives it is drawing a distinction the label cannot ("Right now" on a
// live count, "Booked ahead, not yet arrived" on a population that has not
// shown up yet), which is the only reason for it to be there.
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
        {t.hint && (
          <span className="block text-[10px] text-navy-400 dark:text-navy-400 mt-0.5 leading-snug">
            {t.hint}
          </span>
        )}
      </span>

      <svg className="kpi-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
