import React from 'react';
import type { Visitor } from '../../types/index';
import DashboardPanel from '../../components/DashboardPanel';
import { ICON_SHIELD_X } from '../../lib/tileIcons';

type Props = {
  visitors: Visitor[];
  loading: boolean;
  /** Visitor ids that already have a removal request waiting on the CEO. */
  awaitingCeo: Set<string>;
  /** Opens the justification form. Omitted for a viewer who may not file one. */
  onRequestRemoval?: (visitor: Visitor) => void;
};

// The blacklist itself: who is flagged, why, and since when.
//
// THERE IS NO "Added By" COLUMN. `visitors.is_blacklisted` /
// `blacklist_reason` record the flag and nothing else — no actor, no
// timestamp of the flagging itself. Printing "Admin" on every row would be a
// fabricated attribution on a record someone may later be asked to account
// for, the same class of error CLAUDE.md already forbids for a hardcoded
// "Identity verified" tick. `Date` below is therefore the VISITOR record's
// own `created_at`, not when the flag was set — the only timestamp that
// actually exists on this row.
//
// THIS PANEL IS LIVE STATE, NOT RANGED (client instruction, 2026-08-17). The
// tab's date range bar narrows Denied Entries and the blacklist half of
// Security Alerts, which are events with a date; this roster is "who is
// flagged right now", which has no date to narrow — there being no history of
// the flag being set is exactly why. Ranging it would silently drop
// currently-flagged visitors off screen whenever the picker moved away from a
// window that happens to cover their `created_at`, which is not what
// "blacklisted" means.
//
// IT CARRIES NO CAPTION SAYING SO, and that is the no-duplicate-renders rule,
// not an oversight: the `Blacklisted` KPI tile immediately above this panel
// already reads "Flagged right now — not affected by the date range", and
// repeating the sentence four inches lower makes the eye check whether the two
// agree. The tile is the right place for it — it is the one sitting in a row of
// three where two of its neighbours DO follow the range, which is where the
// ambiguity actually bites.
//
// THE ONE ACTION HERE ASKS; IT DOES NOT REMOVE (client instruction,
// 2026-08-17). "Request Removal" opens a justification form and files a
// request for the CEO — `visitors.is_blacklisted` is untouched by anything on
// this screen, and migration 092's trigger means it could not be otherwise
// even if a later edit tried. The Status cell is what makes that legible: a
// row with a request already open reads **Awaiting CEO** rather than offering
// a button that could only fail against the one-open-request-per-visitor
// index, and a row still reading "Active" is one nobody has asked about yet.
export default function AdminBlacklistPanel({
  visitors, loading, awaitingCeo, onRequestRemoval,
}: Props): React.ReactElement {
  return (
    <DashboardPanel icon={ICON_SHIELD_X} heading="Blacklist" count={visitors.length} loading={loading}>
      <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Reason</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold text-right">Removal</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-navy-500">Loading…</td></tr>
            )}
            {!loading && visitors.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-navy-500">No visitor is currently blacklisted.</td></tr>
            )}
            {!loading && visitors.map((v) => (
              <tr key={v.id} className="border-t border-surface-200/50 dark:border-white/[0.05]">
                <td className="px-4 py-3 text-navy-950 dark:text-white font-medium">{v.full_name}</td>
                <td className="px-4 py-3 text-navy-700">{v.blacklist_reason?.trim() || 'No reason recorded'}</td>
                <td className="px-4 py-3 text-navy-700 whitespace-nowrap tabular-nums">
                  {new Date(v.created_at).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  {awaitingCeo.has(v.id) ? (
                    <span className="status-badge bg-warning-500/15 text-warning-600 dark:text-warning-400 whitespace-nowrap">
                      Awaiting CEO
                    </span>
                  ) : (
                    <span className="status-badge bg-danger-500/15 text-danger-600 dark:text-danger-400">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* No control at all where there is nothing to press — a
                      button an admin cannot honour is worse than no button,
                      the same call the guard's Deny Entry makes. */}
                  {onRequestRemoval && !awaitingCeo.has(v.id) && (
                    <button
                      type="button"
                      onClick={() => onRequestRemoval(v)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap
                                 rounded-lg px-2.5 py-1.5 hover:bg-brand-600/10 transition-colors"
                    >
                      Request removal
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  );
}
