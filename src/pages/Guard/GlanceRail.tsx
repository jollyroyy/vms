import React from 'react';

import { Link } from 'react-router-dom';

import type { ReportVisit } from '../../lib/reportRow';
import { formatTime } from '../../lib/formatDate';
import type { PreRegisteredPill } from './PreRegisteredCard';
import { MORNING_FROM, MORNING_TO, AFTERNOON_FROM, AFTERNOON_TO } from '../../lib/preRegisteredBoard';

// There is NO "VIP Today" row (removed 2026-08-15). It counted
// /(vip|important|executive)/i against `purpose`, which is a seven-value enum —
// meeting, vendor, interview, delivery, maintenance, audit, other. None of them
// can ever match, so the tile was a hardcoded 0 wearing the costume of a
// metric. It broke two standing rules at once: no fuzzy matching against a
// known enum, and no placeholder UI for a field the schema does not have (there
// is no VIP flag on `visitors`). Add the column first, or leave it out.
//
// The window LABELS are rendered from the same constants the counts are
// computed with, so a heading can no longer disagree with the number under it.

// Right rail of the Pre-Registered Arrivals page (reference screen 3):
// "Today at a Glance" — morning arrivals, afternoon expected, VIP count,
// plus the day's schedule list (the same filtered set as the grid, so the
// two panels agree) and the View full schedule link.

type GlanceRailProps = {
  filtered: ReportVisit[];
  morning: number;
  afternoon: number;
  pillFor: (v: ReportVisit, now: Date) => PreRegisteredPill;
  clock: Date;
};

export default function GlanceRail({ filtered, morning, afternoon, pillFor, clock }: GlanceRailProps): React.ReactElement {
  // Bare time is correct HERE and only here: this rail is fed the
  // Pre-Registered board, which `isPreRegisteredArrival` has already narrowed
  // to today. formatTime still pins IST.
  const slotTime = (v: ReportVisit): string => formatTime(v.scheduled_for ?? v.created_at);

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
          <span className="flex items-center gap-2 text-sm text-navy-800">
            <svg className="w-4 h-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Arrivals {MORNING_FROM}:00–{MORNING_TO}:00
          </span>
          <span className="font-display text-kpi tabular-nums text-brand-500">{morning}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-navy-800">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expected {AFTERNOON_FROM}:00–{AFTERNOON_TO}:00
          </span>
          <span className="font-display text-kpi tabular-nums text-brand-500">{afternoon}</span>
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
                // Same destination as the dashboard's Verify ID: every row on
                // this rail is a visitor who has NOT arrived, so a link to the
                // Entry & Exit tab (which lists only people already through the
                // gate) could never find them. Checking them in is the one
                // thing a guard does with this row.
                to={`/guard/preregistered?checkin=${v.id}`}
                className="flex items-center justify-between gap-2 hover:bg-brand-600/5 rounded-lg px-2 py-1 -mx-2 transition-colors">
                <span>
                  <span className="block text-xs tabular-nums font-semibold text-navy-950">{slotTime(v)}</span>
                  <span className="block text-[11px] text-navy-700 truncate max-w-[160px]">
                    {v.visitor?.full_name ?? 'Unknown'}
                    <span className="block font-normal">{v.visitor?.vendor_name ?? ''}</span>
                  </span>
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border shrink-0 ${pill.cls}`}>{pill.label}</span>
              </Link>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-navy-700">Nothing scheduled in this view.</p>}
        </div>
        <Link
          to="/guard/preregistered"
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
