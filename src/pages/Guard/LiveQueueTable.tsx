import React from 'react';

import type { ReportVisit } from '../../lib/reportRow';

// Arrival Queue table of the Live Queue page (reference screen 2). Row click
// or the Verify button selects the visit and opens the check-in frame.

export type LiveQueuePill = { label: string; cls: string };

type LiveQueueTableProps = {
  queue: ReportVisit[];
  loading: boolean;
  initialsOf: (name: string | null | undefined) => string;
  statusPill: (v: ReportVisit) => LiveQueuePill;
  timeOf: (v: ReportVisit) => string;
  onSelect: (v: ReportVisit) => void;
  selectedId: string | null;
};

export default function LiveQueueTable({
  queue,
  loading,
  initialsOf,
  statusPill,
  timeOf,
  onSelect,
  selectedId,
}: LiveQueueTableProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-navy-500 dark:text-navy-400 bg-surface-100/50 dark:bg-white/[0.03]">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Company</th>
            <th className="px-4 py-3 font-semibold">Purpose</th>
            <th className="px-4 py-3 font-semibold">Host</th>
            <th className="px-4 py-3 font-semibold">Time</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-navy-400">
                Loading queue…
              </td>
            </tr>
          )}
          {!loading && queue.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-navy-400">
                No visitors waiting at the gate right now.
              </td>
            </tr>
          )}
          {!loading &&
            queue.map((v) => {
              const pill = statusPill(v);
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
                      <span className="text-navy-950 dark:text-white font-medium truncate">{v.visitor?.full_name ?? 'Unknown'}</span>
                    </span>
                  </td>
                  {/* Company — muted gray so the visitor's name stays the hero */}
                  <td className="px-4 py-3 text-navy-600 dark:text-navy-200">{v.visitor?.vendor_name ?? '—'}</td>
                  {/* Purpose of meeting — muted blue, reads as context next to the host */}
                  <td className="px-4 py-3 text-brand-400 dark:text-brand-300 font-medium">{v.purpose}</td>
                  {/* Host — brightest value so the guard instantly finds who the visitor is meeting */}
                  <td className="px-4 py-3 text-navy-900 dark:text-white font-semibold">{v.host?.full_name ?? v.department?.name ?? '—'}</td>
                  {/* Time — tabular numerals, neutral slate so it never competes */}
                  <td className="px-4 py-3 tabular-nums text-navy-700 dark:text-navy-100 font-semibold">{timeOf(v)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 border ${pill.cls}`}>
                      {pill.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {v.status === 'checked_in' ? (
                      <span className="inline-flex items-center gap-1 text-success-500 text-xs font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Done
                      </span>
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
