import React from 'react';

import type { ReportVisit } from '../../lib/reportRow';

// Live Arrival Queue table from the guard dashboard (reference screen 1).
// Six columns — Name / Purpose / Host / Department / Time / Status — with
// `overflow-x-auto` on the wrapper: the Status column used to be silently
// clipped at typical widths, which is why the guard could not see the
// status at all (client report, 2026-08-14). Rows are clickable and open
// the visitor details popup.

export type QueuePill = { label: string; cls: string };

type ArrivalQueueTableProps = {
  queue: ReportVisit[];
  loading: boolean;
  initialsOf: (name: string | null | undefined) => string;
  statusPill: (visit: ReportVisit) => QueuePill;
  timeOf: (visit: ReportVisit) => string;
  onOpen: (v: ReportVisit) => void;
  selectedId: string | null;
};

export default function ArrivalQueueTable({
  queue,
  loading,
  initialsOf,
  statusPill,
  timeOf,
  onOpen,
  selectedId,
}: ArrivalQueueTableProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-navy-500 dark:text-navy-400 bg-surface-100/50 dark:bg-white/[0.03]">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
              <th className="px-4 py-3 font-semibold">Host</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-navy-400">
                  Loading queue…
                </td>
              </tr>
            )}
            {!loading && queue.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-navy-400">
                  No visitors waiting at the gate right now.
                </td>
              </tr>
            )}
            {!loading &&
              queue.slice(0, 6).map((v) => {
                const pill = statusPill(v);
                return (
                  <tr
                    key={v.id}
                    onClick={() => onOpen(v)}
                    className={`border-t border-surface-200/50 dark:border-white/[0.05] cursor-pointer transition-colors ${
                      selectedId === v.id ? 'bg-brand-600/10 dark:bg-brand-500/15' : 'hover:bg-brand-600/5'
                    }`}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                          {initialsOf(v.visitor?.full_name)}
                        </span>
                        <span className="text-navy-950 dark:text-white font-medium truncate">{v.visitor?.full_name ?? 'Unknown'}</span>
                      </span>
                    </td>
                    {/* Purpose of meeting — muted blue so it reads as context next to the host */}
                    <td className="px-4 py-3 text-brand-400 dark:text-brand-300 font-medium">{v.purpose}</td>
                    {/* Host — brightest value so the guard instantly finds who the visitor is meeting */}
                    <td className="px-4 py-3 text-navy-900 dark:text-white font-semibold">{v.host?.full_name ?? '—'}</td>
                    {/* Department — warm gray keeps it readable but visually secondary */}
                    <td className="px-4 py-3 text-navy-600 dark:text-navy-200 font-medium">{v.department?.name ?? '—'}</td>
                    {/* Time — tabular numerals, neutral slate so it never competes */}
                    <td className="px-4 py-3 tabular-nums text-navy-700 dark:text-navy-100 font-semibold">{timeOf(v)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 border ${pill.cls}`}>
                        {pill.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
