import React from 'react';

import { Link } from 'react-router-dom';

import type { ReportVisit } from '../../lib/reportRow';
import type { PreRegisteredPill } from './PreRegisteredCard';

// Right rail of the Pre-Registered Arrivals page (reference screen 3):
// "Today at a Glance" — morning arrivals, afternoon expected, VIP count,
// plus the day's schedule list (the same filtered set as the grid, so the
// two panels agree) and the View full schedule link.

type GlanceRailProps = {
  filtered: ReportVisit[];
  morning: number;
  afternoon: number;
  vipCount: number;
  pillFor: (v: ReportVisit, now: Date) => PreRegisteredPill;
  clock: Date;
};

export default function GlanceRail({ filtered, morning, afternoon, vipCount, pillFor, clock }: GlanceRailProps): React.ReactElement {
  const slotTime = (v: ReportVisit): string =>
    v.scheduled_for
      ? new Date(v.scheduled_for).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-5">
      <h3 className="font-display text-h2 text-navy-950 dark:text-white flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        Today at a Glance
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
            <svg className="w-4 h-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Arrivals 09:00–12:00
          </span>
          <span className="font-display text-kpi tabular-nums text-brand-500">{morning}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expected 12:00–17:00
          </span>
          <span className="font-display text-kpi tabular-nums text-brand-500">{afternoon}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
            <svg className="w-4 h-4 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            VIP Today
          </span>
          <span className="font-display text-kpi tabular-nums text-warning-400">{vipCount}</span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-surface-200/60 dark:border-white/[0.07]">
        <h4 className="text-sm font-bold text-navy-950 dark:text-white mb-3">Today&rsquo;s Schedule</h4>
        <div className="space-y-2.5">
          {filtered.slice(0, 8).map((v) => {
            const pill = pillFor(v, clock);
            return (
              <Link
                key={v.id}
                to={`/guard/live-queue?verify=${v.id}`}
                className="flex items-center justify-between gap-2 hover:bg-brand-600/5 rounded-lg px-2 py-1 -mx-2 transition-colors">
                <span>
                  <span className="block text-xs tabular-nums font-semibold text-navy-950 dark:text-white">{slotTime(v)}</span>
                  <span className="block text-[11px] text-navy-500 dark:text-navy-400 truncate max-w-[160px]">
                    {v.visitor?.full_name ?? 'Unknown'}
                    <span className="block font-normal">{v.visitor?.vendor_name ?? ''}</span>
                  </span>
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border shrink-0 ${pill.cls}`}>{pill.label}</span>
              </Link>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-navy-400">Nothing scheduled in this view.</p>}
        </div>
        <Link
          to="/guard/live-queue"
          className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-400 transition-colors">
          View full schedule
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
