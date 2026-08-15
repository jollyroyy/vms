import React, { useMemo } from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import { buildVisitTimeline } from '../../lib/visitTimeline';

// WHEN each stage of this visit happened — approval (pre-approved visitors
// only), the slot the pre-approver booked, check-in, check-out.
//
// It sits directly under the step tracker, which answers the neighbouring
// question: the tracker says WHETHER the photo, the ID scan and the host
// notice are done, this says at what time the visitor was cleared, arrived and
// left. Together they are the whole account of a visit, on the one screen a
// guard is looking at when somebody asks them for it.
//
// The DATE is printed once, at the top; every row carries a TIME (client
// instruction). `buildVisitTimeline` collapses the date only when every entry
// falls on the same IST day and hands each row its own date otherwise, so a
// stay that crossed midnight can never read as one that did not.

// No `dark:text-navy-*` here — the navy scale is INVERTED in dark mode, so a
// pair like `text-navy-700 dark:text-navy-200` picks a DARKER colour in dark
// mode. One step resolves correctly in both themes. See CLAUDE.md.
const DOT: Record<string, string> = {
  approved: 'bg-brand-500',
  // The slot the pre-approver chose. Hollow rather than filled: the other three
  // dots mark something that HAPPENED, this one marks a time that was intended,
  // and a guard reading down the rail should not have to check the label to
  // tell an intention from a record.
  scheduled: 'bg-transparent border-2 border-brand-500',
  checked_in: 'bg-success-500',
  checked_out: 'bg-navy-600',
};

export default function CheckInTimeline({ visit }: { visit: ReportVisit }): React.ReactElement | null {
  const timeline = useMemo(() => buildVisitTimeline(visit), [visit]);

  // Nothing has happened yet that can be timed. An empty rail with three
  // em dashes would be three claims of "no time recorded" where the honest
  // answer is that this visit has not reached any of those stages.
  if (timeline.entries.length === 0) return null;

  return (
    <div className="w-full mt-8 pt-6 border-t border-surface-200/60 dark:border-white/[0.07]">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-700">
          Visit Timeline
        </h4>
        {timeline.date && (
          <span className="text-sm font-semibold text-navy-950 dark:text-white tabular-nums">
            {timeline.date}
          </span>
        )}
      </div>

      <ol className="space-y-3">
        {timeline.entries.map((e) => (
          <li key={e.key} className="flex items-center gap-3">
            <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${DOT[e.key]}`} aria-hidden="true" />
            <span className="flex-1 min-w-0 text-sm font-medium text-navy-950 dark:text-white">{e.label}</span>
            <span className="text-sm font-semibold tabular-nums text-navy-800 whitespace-nowrap">
              {/* The per-entry date appears ONLY when this visit's stages span
                  more than one IST day — otherwise the single header date
                  above already said it. */}
              {e.date ? `${e.date}, ${e.time}` : e.time}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
