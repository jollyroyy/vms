import React from 'react';
import type { ReportVisit } from '../../lib/reportRow';
import { DRILL_COPY, drillVisits, type DrillKey } from '../../lib/dashboardDrill';
import WhosInsideVisitorCard from '../Shared/WhosInsideVisitorCard';

type Props = {
  drillKey: DrillKey;
  loading: boolean;
  visits: ReportVisit[];
  onSelect: (visit: ReportVisit) => void;
  onClose: () => void;
};

// The panel a KPI tile expands into, in place, on the dashboard. Replaced
// GuardInsideNow, which only ever rendered the on-site roster — the copy and the
// filter are now looked up per tile so all five tiles share this one surface
// instead of each growing its own list component.
export default function DashboardDrilldown({
  drillKey, loading, visits, onSelect, onClose,
}: Props): React.ReactElement {
  const copy = DRILL_COPY[drillKey];
  const rows = drillVisits(visits, drillKey);

  return (
    <section className="card-premium overflow-hidden animate-slide-up" aria-label={copy.title}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-surface-100 dark:border-white/[0.06]">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-navy-950 dark:text-white tracking-tight">
            {copy.title}
          </h2>
          <p className="text-xs text-navy-400 mt-0.5 truncate">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="glass-chip !py-1.5 !px-3 text-[11px] font-bold tabular-nums">
            {loading ? '—' : `${rows.length} ${copy.countLabel}`}
          </span>
          <button type="button" onClick={onClose} aria-label={`Collapse ${copy.title}`}
            className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-surface-100 dark:hover:bg-white/[0.06] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-5 flex flex-col gap-4">
          {[0, 1].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state !py-12 px-5">
          <p className="text-sm font-semibold text-navy-500">{copy.empty}</p>
        </div>
      ) : (
        // A full-width vertical stack, not a 2-up grid — the client's core
        // complaint (2026-08-10) was exactly this doubling of scan travel.
        <div data-card-list className="p-4 flex flex-col gap-4">
          {rows.map((v, i) => (
            <WhosInsideVisitorCard key={v.id} visit={v} index={i} onClick={() => onSelect(v)} />
          ))}
        </div>
      )}
    </section>
  );
}
