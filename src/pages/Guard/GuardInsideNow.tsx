import React from 'react';
import type { ReportVisit } from '../../lib/reportRow';
import WhosInsideVisitorCard from '../Shared/WhosInsideVisitorCard';

type Props = {
  loading: boolean;
  visits: ReportVisit[];
  onSelect: (visit: ReportVisit) => void;
};

export default function GuardInsideNow({ loading, visits, onSelect }: Props): React.ReactElement {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-100 dark:border-white/[0.06]">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Inside Now</h2>
          <p className="text-xs text-navy-400 mt-0.5">Visitors currently on site</p>
        </div>
        <span className="text-[11px] font-bold text-success-700 bg-success-50 px-3 py-1.5 rounded-full whitespace-nowrap tabular-nums">
          {visits.length} on site
        </span>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[0, 1].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
        </div>
      ) : visits.length === 0 ? (
        <div className="py-10 px-5 text-center">
          <p className="text-sm font-semibold text-navy-500">No one is inside right now.</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visits.map((v, i) => (
            <WhosInsideVisitorCard key={v.id} visit={v} index={i} onClick={() => onSelect(v)} />
          ))}
        </div>
      )}
    </div>
  );
}
