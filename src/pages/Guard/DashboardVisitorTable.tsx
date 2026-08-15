import React from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import type { DashboardColumn } from '../../lib/dashboardColumns';
import GateChips from '../../components/GateChips';

// The guard dashboard's ONE list. Whatever tile is pressed, this renders it.
//
// It superseded ArrivalQueueTable (six fixed columns, one tile) and
// KpiDrilldownSheet (stacked cards, the other six) on 2026-08-15. Two layouts
// for the same rows meant a guard re-learned the board depending on which
// number they had pressed, and the fixed table's heading said "Expected Today"
// no matter what was in it. The columns come from PANEL_SPEC in
// lib/dashboardColumns.ts — one spec per tile, so adding a column is one edit
// in a file with no JSX in it.
//
// `overflow-x-auto` on the wrapper is load-bearing: the Status column used to
// be silently clipped at typical widths, so the guard could not see the status
// at all (client report, 2026-08-14). The widest spec here carries eight
// columns, so it matters more now, not less.

type DashboardVisitorTableProps = {
  rows: ReportVisit[];
  columns: DashboardColumn[];
  loading: boolean;
  empty: string;
  now: Date;
  initialsOf: (name: string | null | undefined) => string;
  onOpen: (v: ReportVisit) => void;
};

export default function DashboardVisitorTable({
  rows,
  columns,
  loading,
  empty,
  now,
  initialsOf,
  onOpen,
}: DashboardVisitorTableProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-navy-500 dark:text-navy-400 bg-surface-100/50 dark:bg-white/[0.03]">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold whitespace-nowrap">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[#9aa3af] dark:text-[#b7c0cb]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[#9aa3af] dark:text-[#b7c0cb]">
                  {empty}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => onOpen(v)}
                  className="border-t border-surface-200/50 dark:border-white/[0.05] cursor-pointer transition-colors hover:bg-brand-600/5">
                  {columns.map((c) => {
                    // The status cell is the shared chip row, not a string: it
                    // carries presence AND the exceptions (overstaying, late
                    // arrival), which is more than one value can say.
                    if (c.key === 'status') {
                      return (
                        <td key={c.key} className="px-4 py-3"><GateChips visit={v} now={now} /></td>
                      );
                    }
                    // The name cell leads with the FACE where there is one, so
                    // the eye finds the person before it reads anything else on
                    // the row (client instruction, 2026-08-15). Every visit that
                    // has been through a check-in carries a photo — it is
                    // mandatory on every check-in path — so this is the whole
                    // In Premises, Checked In and Approved Walk-ins population,
                    // and a guard matching a row to somebody in front of them
                    // was being handed two letters instead. The monogram stays
                    // as the fallback for a row that has not reached a camera
                    // yet, rather than an empty circle.
                    if (c.key === 'name') {
                      return (
                        <td key={c.key} className="px-4 py-3">
                          <span className="flex items-center gap-2.5">
                            {v.photo_url ? (
                              <img
                                src={v.photo_url}
                                alt=""
                                className="w-8 h-8 shrink-0 rounded-full object-cover ring-2 ring-brand-500/25"
                              />
                            ) : (
                              <span className="w-8 h-8 shrink-0 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                                {initialsOf(v.visitor?.full_name)}
                              </span>
                            )}
                            <span className="text-navy-950 dark:text-white font-medium truncate">
                              {c.value(v, now)}
                            </span>
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={c.key}
                        className={`px-4 py-3 whitespace-nowrap ${
                          c.tone === 'warn'
                            ? 'text-warning-500 dark:text-warning-400 font-bold tabular-nums'
                            : 'text-[#9aa3af] dark:text-[#b7c0cb] font-medium tabular-nums'
                        }`}>
                        {c.value(v, now)}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
