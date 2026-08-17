import React from 'react';
import type { Visitor } from '../../types/index';
import DashboardPanel from '../../components/DashboardPanel';
import { ICON_SHIELD_X } from '../../lib/tileIcons';

type Props = { visitors: Visitor[]; loading: boolean };

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
export default function AdminBlacklistPanel({ visitors, loading }: Props): React.ReactElement {
  return (
    <DashboardPanel icon={ICON_SHIELD_X} heading="Blacklist" count={visitors.length} loading={loading}>
      <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-navy-500 bg-surface-100/50 dark:bg-white/[0.03]">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-navy-500">Loading…</td></tr>
            )}
            {!loading && visitors.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-navy-500">No visitor is currently blacklisted.</td></tr>
            )}
            {!loading && visitors.map((v) => (
              <tr key={v.id} className="border-t border-surface-200/50 dark:border-white/[0.05]">
                <td className="px-4 py-3 text-navy-950 dark:text-white font-medium">{v.full_name}</td>
                <td className="px-4 py-3 text-navy-700">{v.blacklist_reason?.trim() || 'No reason recorded'}</td>
                <td className="px-4 py-3 text-navy-700 whitespace-nowrap tabular-nums">
                  {new Date(v.created_at).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  <span className="status-badge bg-danger-500/15 text-danger-600 dark:text-danger-400">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  );
}
