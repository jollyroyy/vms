import React from 'react';
import type { Visit } from '../types/index';
import { isOverstaying, overstayMs } from '../lib/visitExpiry';
import { formatDuration } from '../lib/dashboardColumns';

// A VISITOR WHO IS STILL INSIDE PAST THEIR TIME IS SAID IN RED, AT THE TOP
// (client instruction, 2026-08-18: "apart from showing in the overstaying
// field, flag it in red on the top" — the guard's board, the admin dashboard
// and that department's HOD dashboard alike).
//
// The Overstaying tile is a number in a row of five, and a number in a row of
// five is something you read when you happen to look at it. This is the one
// fact on any of these boards that is about a PERSON who is still in the
// building and should not be, so it gets the line above everything else and it
// gets the only red on the screen.
//
// IT IS THE SAME PREDICATE AS THE TILE, deliberately: `isOverstaying` from
// lib/visitExpiry.ts, which is what `TILE_FILTER.overstaying` (guard),
// `hodTiles` and `adminSecurity` all use. A banner with a threshold of its own
// would be a second answer to "who is overdue" on the same screen as the first,
// which is the defect this project has fixed repeatedly — and the two would
// disagree at exactly the moment somebody acted on one of them. The deadline
// itself is the approver's `expected_departure` where one was given, and
// twelve hours from entry where it was not (`overstayDeadline`).
//
// COLOUR IS NEVER THE ONLY CARRIER: the heading says "Overstaying", each row
// names the visitor and how far past their time they are, and the banner
// carries `role="alert"`.

type Props = {
  /** Any list of visits. Rows that are not overstaying are ignored, so callers
   *  pass whatever they already loaded rather than a second query. */
  visits: Visit[];
  /** Injected by tests; the elapsed figures are relative to it. */
  now?: Date;
  /** How many visitors to name before summarising the rest. */
  max?: number;
};

export default function OverstayAlertBanner({ visits, now = new Date(), max = 4 }: Props): React.ReactElement | null {
  // Longest overrun first: if the list is trimmed, the row that is trimmed is
  // the least urgent one, never the most.
  const overdue = visits
    .filter((v) => isOverstaying(v, now))
    .map((v) => ({ visit: v, ms: overstayMs(v, now) }))
    .sort((a, b) => b.ms - a.ms);

  // Nothing to flag is not a state worth a box. An empty red banner reading
  // "0 overstaying" would be the loudest element on a board on a quiet day.
  if (overdue.length === 0) return null;

  const shown = overdue.slice(0, max);
  const hidden = overdue.length - shown.length;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 px-4 py-3.5 flex items-start gap-3">
      <svg className="w-5 h-5 shrink-0 text-danger-700 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-danger-700">
          {overdue.length === 1
            ? '1 visitor is overstaying'
            : `${overdue.length} visitors are overstaying`}
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {shown.map(({ visit, ms }) => (
            <li key={visit.id} className="text-sm text-danger-700/90 flex flex-wrap gap-x-2">
              <span className="font-semibold">{visit.visitor?.full_name ?? 'Unnamed visitor'}</span>
              <span className="tabular-nums">over by {formatDuration(ms)}</span>
              {/* The host, not the department: on the guard's board and the
                  admin's the department is on the row below in the panel, and
                  on an HOD's board every row is their own department. Who the
                  visitor came to see is who anybody chasing this would call. */}
              {visit.host?.full_name && <span className="opacity-80">· to see {visit.host.full_name}</span>}
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <p className="text-xs font-semibold text-danger-700/80 mt-1">
            and {hidden} more — see the Overstaying tile below
          </p>
        )}
      </div>
    </div>
  );
}
