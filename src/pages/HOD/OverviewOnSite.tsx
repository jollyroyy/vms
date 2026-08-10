import React from 'react';
import type { Visit } from '../../types/index';
import { formatTime, formatDuration } from '../../lib/formatDate';

type Props = {
  loading: boolean;
  onSite: Visit[];
};

export default function OverviewOnSite({ loading, onSite }: Props): React.ReactElement {
  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
        <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">On-site now</h2>
        <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">Checked-in visitors for your department</p>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[0, 1].map(i => <div key={i} className="skeleton h-[52px] w-full rounded-xl" />)}
        </div>
      ) : onSite.length === 0 ? (
        <div className="py-8 px-6 flex flex-col items-center text-center">
          <svg className="w-8 h-8 text-surface-300 dark:text-navy-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No one on site right now</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-white/[0.04]">
          {onSite.map((v) => {
            const dur = v.checked_in_at ? formatDuration(v.checked_in_at) : null;
            return (
              <div key={v.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-navy-900 dark:text-white truncate">
                    {v.visitor?.full_name ?? '—'}
                    {v.visitor?.vendor_name && <span className="text-navy-500 dark:text-navy-400 font-normal"> — {v.visitor.vendor_name}</span>}
                  </p>
                  <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5 truncate">
                    {v.host?.full_name ? `Person to Meet: ${v.host.full_name}` : 'Person to Meet: —'}
                  </p>
                  {v.host?.full_name && v.department?.name && (
                    <p className="text-xs text-navy-500 dark:text-navy-400 truncate">{v.department.name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-navy-700 dark:text-navy-200 tabular-nums">{formatTime(v.checked_in_at)}</p>
                  {dur && <p className="text-[11px] text-navy-500 dark:text-navy-400">{dur.text}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
