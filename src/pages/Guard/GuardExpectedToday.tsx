import React from 'react';
import { Link } from 'react-router-dom';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { formatTime } from '../../lib/formatDate';

type Props = {
  loading: boolean;
  visits: Visit[];
};

export default function GuardExpectedToday({ loading, visits }: Props): React.ReactElement {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-100 dark:border-white/[0.06]">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Expected Today</h2>
          <p className="text-xs text-navy-400 mt-0.5">Pre-approved &amp; walk-in approved, awaiting gate check-in</p>
        </div>
        <Link to="/visitors?tab=expected"
          className="text-[11px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
          Check In &rarr;
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
        </div>
      ) : visits.length === 0 ? (
        <div className="py-10 px-5 text-center">
          <p className="text-sm font-semibold text-navy-500">No one expected today.</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-white/[0.05]">
          {visits.map((v) => {
            const style = STATUS_STYLES[v.status];
            return (
              <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                <div className="shrink-0 w-16 text-center">
                  <span className="font-display font-bold text-sm text-navy-900 dark:text-white tabular-nums">
                    {v.scheduled_for ? formatTime(v.scheduled_for) : 'Anytime'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy-900 dark:text-white truncate">{v.visitor?.full_name ?? '—'}</p>
                  <p className="text-xs text-navy-400 truncate">
                    {v.host?.full_name ? `Host: ${v.host.full_name}` : ''}{v.department?.name ? ` · ${v.department.name}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
