import React from 'react';
import { useWatchlist } from '../../lib/useWatchlist';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { formatDateTime } from '../../lib/formatDate';
import type { VisitStatus } from '../../types/index';

// This page must never render a QR code, badge, or entry pass — a guard can
// look someone up here but must not be able to mint an entry credential from
// it. See the comment block at the top of Console.tsx for why. No Badge
// import on purpose.

function reasonOrFallback(reason: string | null): string {
  return reason && reason.trim().length > 0 ? reason : 'Flagged';
}

export default function GuardWatchlist(): React.ReactElement {
  const { entries, alerts, loading } = useWatchlist();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-950 dark:text-white">Watchlist &amp; Alerts</h1>
        <p className="text-sm text-navy-400 mt-1">Flagged visitors and any of them active at the gate today</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-100 dark:border-white/[0.06]">
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Active Alerts</h2>
          <span className="text-[11px] font-bold text-danger-700 bg-danger-50 px-2.5 py-1 rounded-full">
            {alerts.length}
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <p className="text-sm font-semibold text-success-700">No flagged visitors on site today.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-white/[0.05]">
            {alerts.map((a) => {
              const style = STATUS_STYLES[a.status as VisitStatus];
              return (
                <div key={a.id} className="bg-danger-50 border border-danger-200 dark:border-danger-500/25 rounded-xl p-3 m-3 flex items-start gap-3">
                  <svg className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-danger-900 dark:text-danger-700 truncate">{a.visitor.full_name}</p>
                    <p className="text-xs text-danger-700">{a.visitor.phone}</p>
                    <p className="text-sm text-danger-700 font-semibold mt-1">{reasonOrFallback(a.visitor.blacklist_reason)}</p>
                    <p className="text-[11px] text-navy-400 mt-1">{formatDateTime(a.created_at)}</p>
                  </div>
                  {style && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-100 dark:border-white/[0.06]">
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Flagged Visitors</h2>
          <span className="text-[11px] font-bold text-navy-500 bg-surface-100 px-2.5 py-1 rounded-full">
            {entries.length}
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">No visitors are currently flagged.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-white/[0.05]">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy-900 dark:text-white truncate">{e.full_name}</p>
                  <p className="text-xs text-navy-400 truncate">
                    {e.phone}{e.vendor_name ? ` · ${e.vendor_name}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-danger-700 bg-danger-50 px-2.5 py-1 rounded-md max-w-[45%] truncate">
                  {reasonOrFallback(e.blacklist_reason)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
