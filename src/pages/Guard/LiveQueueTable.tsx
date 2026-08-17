import React from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import { visitOrigin, visitOriginLabel } from '../../lib/visitOrigin';
import GateChips from '../../components/GateChips';

// The Entry & Exit table. Row click or the Verify button selects the visit and
// opens the check-in frame.
//
// It carries BOTH times in their own columns — In and Out — because the tab is
// named for the two events and a guard asked "when did she leave?" should not
// have to select a row to find out. A visitor still on site shows an em dash
// under Out, never a blank: blank reads as "not recorded", and here it means
// "still here", which is precisely the distinction being looked for.
//
// THE STATUS CELL IS A ROW OF SMALL BOXED LABELS, not one pill (client
// instruction, 2026-08-15). A checked-in row now says in words whether the
// person is STILL INSIDE or has CHECKED OUT, and adds a box for each exception
// that applies: OVERSTAYING (with the overrun) and LATE BY (how far past their
// booked slot they actually arrived). Lateness is stated on a row that has
// already checked in on purpose — "they arrived" and "they arrived two hours
// late" are two different facts, and the second does not stop being true once
// the first is. The rules are in lib/visitGateChips.ts, shared with the guard
// dashboard, so one visitor reads identically on both surfaces.

type LiveQueueTableProps = {
  queue: ReportVisit[];
  loading: boolean;
  initialsOf: (name: string | null | undefined) => string;
  timeOf: (v: ReportVisit) => string;
  /** The exit time, or an em dash for a visitor still on site. */
  exitTimeOf: (v: ReportVisit) => string;
  /** Empty-state copy. Each Entry & Exit lane says its own thing — "nobody is
   *  inside" and "nobody has left yet" are different facts. */
  emptyMessage?: string;
  onSelect: (v: ReportVisit) => void;
  selectedId: string | null;
  /** Check this visitor out straight from the row. Omitted, the last column
      keeps the old read-only "Done" tick. */
  onCheckOut?: (v: ReportVisit) => void;
};

export default function LiveQueueTable({
  queue,
  loading,
  initialsOf,
  timeOf,
  exitTimeOf,
  emptyMessage,
  onSelect,
  selectedId,
  onCheckOut,
}: LiveQueueTableProps): React.ReactElement {
  return (
    // `overflow-x-auto`, not `overflow-hidden`. The In and Out cells carry the
    // full date as well as the time since 2026-08-17 (client instruction), so
    // nine columns can outgrow a narrow window — and a clipped exit time is
    // indistinguishable from one that was never recorded, which is the exact
    // distinction this table exists to draw. Scroll it; never cut it off.
    <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-4 py-3 font-bold">Name</th>
            <th className="px-4 py-3 font-bold">Type of Visitor</th>
            <th className="px-4 py-3 font-bold">Company</th>
            <th className="px-4 py-3 font-bold">Purpose</th>
            <th className="px-4 py-3 font-bold">Host</th>
            <th className="px-4 py-3 font-bold">In</th>
            <th className="px-4 py-3 font-bold">Out</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold" />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-[#9aa3af] dark:text-[#b7c0cb]">
                Loading queue…
              </td>
            </tr>
          )}
          {!loading && queue.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-[#9aa3af] dark:text-[#b7c0cb]">
                {emptyMessage ?? 'Nobody is on site, and nobody has checked out today.'}
              </td>
            </tr>
          )}
          {!loading &&
            queue.map((v) => {
              return (
                <tr
                  key={v.id}
                  onClick={() => onSelect(v)}
                  className={`border-t border-surface-200/50 dark:border-white/[0.05] cursor-pointer transition-colors ${
                    selectedId === v.id
                      ? 'bg-brand-600/10 dark:bg-brand-500/15'
                      : 'hover:bg-brand-600/5'
                  }`}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                        {initialsOf(v.visitor?.full_name)}
                      </span>
                      {/* No `truncate`: a clipped name on the gate's own list is
                          the one value that must never be half-shown, and the
                          cell has no width cap forcing it anyway. */}
                      <span className="text-navy-950 dark:text-white font-medium">{v.visitor?.full_name ?? 'Unknown'}</span>
                    </span>
                  </td>
                  {/* Booked ahead or turned up unannounced (client instruction,
                      2026-08-16). Both kinds are on this tab by definition — it
                      lists everyone the gate let through today — and by then
                      every route has converged on `checked_in`, so the Status
                      chip beside it can no longer say which desk they came
                      through. lib/visitOrigin.ts, the same answer the dashboard
                      panel and the admin register print. */}
                  <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-medium whitespace-nowrap">{visitOriginLabel(visitOrigin(v))}</td>
                  {/* Company — soft silver, legible but secondary to the name */}
                  <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb]">{v.visitor?.vendor_name ?? '—'}</td>
                  {/* Purpose of meeting — blue, reads as context next to the host */}
                  <td className="px-4 py-3 text-[#6fa8dc] dark:text-[#7fb3e3] font-medium">{v.purpose}</td>
                  {/* Host — brightest value so the guard instantly finds who the visitor is meeting */}
                  <td className="px-4 py-3 text-navy-900 dark:text-white font-semibold">{v.host?.full_name ?? v.department?.name ?? '—'}</td>
                  {/* Times — light silver with tabular numerals so the numbers
                      never compete. Date AND time on every row, `nowrap` so
                      "14 Aug 2026, 10:30 am" cannot break after "14 Aug". */}
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap text-[#9aa3af] dark:text-[#b7c0cb] font-semibold">{timeOf(v)}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap text-[#9aa3af] dark:text-[#b7c0cb] font-semibold">{exitTimeOf(v)}</td>
                  <td className="px-4 py-3">
                    <GateChips visit={v} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* A visitor who has already left has nothing left to do to
                        them here. The row stays selectable — the frame holds
                        their timeline and their pass — but it offers no action,
                        because the only one this page has is the exit and it has
                        already happened. */}
                    {v.status === 'checked_out' ? (
                      <span className="inline-flex items-center gap-1 text-navy-400 dark:text-navy-500 text-xs font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Left
                      </span>
                    ) : v.status === 'checked_in' ? (
                      // The green "Done" tick that used to sit here was on
                      // every row and did nothing — a whole column of dead
                      // space on the one screen where the guard needs to let
                      // people OUT. The exit takes its place, one click from
                      // the row, with no selection step in between.
                      onCheckOut ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCheckOut(v); }}
                          className="rounded-lg bg-danger-600 hover:bg-danger-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors">
                          Check Out
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success-500 text-xs font-semibold">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Done
                        </span>
                      )
                    ) : (
                      <button
                        onClick={() => onSelect(v)}
                        className="rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors">
                        {v.status === 'approved' || v.status === 'walkin_approved' ? 'Check In' : 'Verify'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
