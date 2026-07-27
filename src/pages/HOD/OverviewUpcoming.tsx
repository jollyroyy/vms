import React from 'react';
import { Link } from 'react-router-dom';
import type { Visit } from '../../types/index';

const PURPOSE_LABELS: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

type Props = {
  loading: boolean;
  upcoming: Visit[];
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime24 = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function OverviewUpcoming({ loading, upcoming }: Props): React.ReactElement {
  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Upcoming visits</h2>
          <p className="text-xs text-navy-400 mt-0.5">
            Pending &amp; pre-approved · up to 30 days ahead, max 15 entries
          </p>
        </div>
        {!loading && (
          <span className="text-[11px] font-bold text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
            {upcoming.length} visit{upcoming.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-[72px] w-full rounded-xl" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="py-14 px-6 flex flex-col items-center text-center">
          <svg className="w-10 h-10 text-surface-300 dark:text-navy-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No upcoming visits</p>
          <p className="text-xs text-navy-400 mt-1">Scheduled and pre-approved visits will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-white/[0.04]">
          {upcoming.map((v) => {
            const when = v.scheduled_for ?? v.created_at;
            const timeStr = fmtTime24(when);
            const dateStr = fmtDate(when).slice(0, 5);
            const isApproved = v.status === 'approved' || v.status === 'walkin_approved';
            return (
              <div key={v.id} className="flex items-stretch hover:bg-surface-50/80 dark:hover:bg-white/[0.02] transition-colors">
                <div className="shrink-0 w-[72px] flex flex-col items-center justify-center py-4 px-2">
                  <span className="font-display font-bold text-[15px] text-navy-900 dark:text-white tabular-nums leading-none">{timeStr}</span>
                  <span className="text-[11px] text-navy-400 mt-0.5 tabular-nums">{dateStr}</span>
                </div>
                <div className="w-px bg-surface-200/70 dark:bg-white/[0.07] self-stretch my-3 shrink-0" />
                <div className="flex-1 min-w-0 py-4 px-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-navy-900 dark:text-white leading-snug">
                        {PURPOSE_LABELS[v.purpose] ?? v.purpose}
                        {v.visitor?.company && <span className="text-navy-400 font-normal"> — {v.visitor.company}</span>}
                      </p>
                      <p className="text-xs text-navy-400 mt-0.5">
                        {v.host?.full_name ? `Host: ${v.host.full_name}` : 'Host: —'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25'}`}>{isApproved ? 'Pre-Approved' : 'Pending'}</span>
                      <Link to="/approvals" className="text-[11px] font-semibold text-navy-600 dark:text-navy-300 bg-surface-100 dark:bg-white/[0.06] hover:bg-surface-200 dark:hover:bg-white/[0.10] border border-surface-200 dark:border-white/[0.08] px-3 py-1 rounded-lg transition-colors whitespace-nowrap">
                        Open details
                      </Link>
                    </div>
                  </div>
                  {v.visitor && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="inline-flex items-center text-[11px] font-medium bg-surface-100 dark:bg-white/[0.06] text-navy-600 dark:text-navy-300 px-2.5 py-0.5 rounded-full border border-surface-200/70 dark:border-white/[0.08]">
                        {v.visitor.full_name}
                      </span>
                      {v.visitor.company && (
                        <span className="inline-flex items-center text-[11px] font-medium bg-surface-100 dark:bg-white/[0.06] text-navy-500 dark:text-navy-400 px-2.5 py-0.5 rounded-full border border-surface-200/70 dark:border-white/[0.08]">
                          {v.visitor.company}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
