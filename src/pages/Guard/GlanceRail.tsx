import React from 'react';

import { WINDOW_HOURS, type ArrivalWindows } from '../../lib/preRegisteredBoard';

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

// Right rail of the Pre-Registered Arrivals page: "Today at a Glance" — the
// shape of the day, in arrival blocks, and nothing else.
//
// There is NO "Today's Schedule" list and no "View full schedule" link
// (removed 2026-08-15, client instruction). The list was the first eight rows
// of the very board rendered beside it — the same visitors, the same slot
// times, the same status pills, twice on one screen, which is the
// no-duplicate-renders rule. Its empty state ("Nothing scheduled in this
// view.") then contradicted the grid's own empty state a few hundred pixels
// left. And the link pointed at `/guard/preregistered`, the page the guard was
// already standing on, so pressing it did nothing at all — the same defect that
// made the dashboard's old Deny Entry control a no-op. The board is the full
// schedule; this rail counts it.

type GlanceRailProps = {
  windows: ArrivalWindows;
};

export default function GlanceRail({ windows }: GlanceRailProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-5">
      <h3 className="font-display text-h2 text-navy-950 dark:text-white flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        Today at a Glance
      </h3>

      {/* Expected arrivals, one row per block of the day. Each row's bar is
          that block's share of the busiest block, so the shape of the day —
          which the guard is really asking about — reads without arithmetic.
          Empty blocks stay on screen, greyed: "nobody between 3 and 6" is an
          answer, and a rail whose rows appear and vanish through the day is one
          a guard has to re-read every time. */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-700 mb-2">
        Expected arrivals · {WINDOW_HOURS}-hour blocks
      </p>
      <div className="space-y-1.5">
        {windows.windows.map((w) => {
          const peak = Math.max(1, ...windows.windows.map((x) => x.count));
          const share = Math.round((w.count / peak) * 100);
          return (
            <div key={w.from} className="flex items-center gap-3">
              <span className={`text-xs tabular-nums w-[92px] shrink-0 ${w.count ? 'text-navy-800' : 'text-navy-600'}`}>
                {w.label}
              </span>
              <span className="flex-1 h-1.5 rounded-full bg-navy-950/[0.06] dark:bg-white/[0.06] overflow-hidden">
                <span
                  className="block h-full rounded-full bg-brand-500 transition-[width] duration-500"
                  style={{ width: `${w.count ? Math.max(share, 8) : 0}%` }}
                />
              </span>
              <span className={`font-display text-base tabular-nums w-6 text-right ${w.count ? 'text-brand-500' : 'text-navy-600'}`}>
                {w.count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Never hidden. These two are what keeps the blocks honest: with them on
          screen the rows add up to the board, and a booking at 05:00 or a legacy
          pre-approval with no slot cannot silently go uncounted. */}
      {(windows.outside > 0 || windows.unscheduled > 0) && (
        <div className="mt-2.5 pt-2.5 border-t border-surface-200/60 dark:border-white/[0.07] space-y-1">
          {windows.outside > 0 && (
            <p className="flex items-center justify-between text-xs text-navy-700">
              <span>Outside these hours</span>
              <span className="tabular-nums font-bold text-navy-800">{windows.outside}</span>
            </p>
          )}
          {windows.unscheduled > 0 && (
            <p className="flex items-center justify-between text-xs text-navy-700">
              <span>No time set</span>
              <span className="tabular-nums font-bold text-navy-800">{windows.unscheduled}</span>
            </p>
          )}
        </div>
      )}

    </div>
  );
}
