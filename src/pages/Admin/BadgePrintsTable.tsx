import React from 'react';
import type { BadgePrintRow } from '../../lib/useBadgePrints';
import { formatTime } from '../../lib/formatDate';
import { initialsOf } from '../../lib/initials';

// Badge prints for the selected window, newest first. A plain table rather than
// `DashboardVisitorTable`, which takes `ReportVisit[]` and composes from
// `COLUMN` — the atoms there describe a VISIT (Checked In, Scheduled,
// Status…), and a badge print is a different row shape hung off a visit, not
// a visit itself. Forcing it through that component would mean either padding
// every visit column onto a badge row that has no use for most of them, or
// widening `COLUMN` with cells that exist for this one table alone.

const BADGE_TYPE_LABEL: Record<string, string> = {
  visitor: 'Visitor',
  contractor: 'Contractor',
  reprint: 'Reprint',
};

type Props = {
  prints: BadgePrintRow[];
  loading: boolean;
};

export default function BadgePrintsTable({ prints, loading }: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-navy-700 bg-surface-100/50 dark:bg-white/[0.03]">
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Visitor</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Company</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Host</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Badge Type</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Printed At</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Printed By</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#9aa3af] dark:text-[#b7c0cb]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && prints.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#9aa3af] dark:text-[#b7c0cb]">
                  {/* Explains the empty box rather than leaving it ambiguous:
                      an empty table here reads exactly like a broken query, so
                      it says outright that nothing happened in this window —
                      the range bar above states which window that is. */}
                  No badge was printed in this window.
                </td>
              </tr>
            )}
            {!loading && prints.map((p) => {
              const visitor = p.visit?.visitor;
              return (
                <tr key={p.id} className="border-t border-surface-200/50 dark:border-white/[0.05]">
                  <td className="px-4 py-3">
                    {/* Same face treatment as `DashboardVisitorTable`'s name
                        cell — the app's one visitor-face pattern: lead with
                        the photo where the visit carries one (every visit
                        that reached a check-in does), fall back to the
                        monogram rather than an empty circle otherwise. */}
                    <span className="flex items-center gap-2.5">
                      {p.visit?.photo_data ? (
                        <img
                          src={p.visit.photo_data}
                          alt=""
                          className="w-8 h-8 shrink-0 rounded-full object-cover ring-2 ring-brand-500/25"
                        />
                      ) : (
                        <span className="w-8 h-8 shrink-0 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                          {initialsOf(visitor?.full_name)}
                        </span>
                      )}
                      <span className="text-navy-950 dark:text-white font-medium truncate">
                        {visitor?.full_name ?? 'Unknown'}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-navy-800">
                    {visitor?.vendor_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-navy-800">
                    {p.visit?.host?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-navy-800">
                    {BADGE_TYPE_LABEL[p.badge_type] ?? p.badge_type}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-navy-800 tabular-nums">
                    {formatTime(p.printed_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-navy-800">
                    {/* The kiosk prints under a device session that is not a
                        person, so a null here is a real fact, not a gap in the
                        join — "Not recorded" says that plainly. */}
                    {p.printed_by_profile?.full_name ?? 'Not recorded'}
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
