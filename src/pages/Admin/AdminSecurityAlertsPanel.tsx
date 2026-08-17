import React from 'react';
import type { SecurityAlert } from '../../lib/adminSecurity';
import DashboardPanel from '../../components/DashboardPanel';

const ICON_WARN = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z';

const KIND_LABEL: Record<SecurityAlert['kind'], string> = {
  blacklist: 'Blacklisted visitor',
  overstay: 'Overstaying',
};

type Props = { alerts: SecurityAlert[]; loading: boolean };

// Alerts, built from REAL rows only (lib/adminSecurity.ts): a blacklisted
// visitor on the selected window's activity, or a visitor past their
// overstay deadline right now. Nothing here is invented — there is no gates
// table and no alert type this app cannot actually detect.
//
// THIS PANEL HOLDS BOTH A RANGED HALF AND A LIVE HALF, and says so — the one
// blurb below is what stops a reader guessing which is which (client
// instruction, 2026-08-17). Blacklist alerts follow the `AdminRangeBar`
// above the tab; overstay alerts never do, because an overstay is a fact
// about this instant and cannot be dated into the past (lib/adminSecurity.ts
// header). `KIND_LABEL` on each row is the row-level half of the same
// disclosure — "Blacklisted visitor" is a dated event, "Overstaying" is a
// live one — but the blurb states the rule once up front rather than making
// every reader infer it row by row.
//
// NO "Resolve" BUTTON. Nothing in the schema records an alert being
// resolved — there is no alerts table at all, this list is recomputed from
// `visits`/`visitors` on every render — so a Resolve control could not
// persist anything it claimed to do. The same reasoning that keeps a
// "Gate Status: Operational" chip out of the guard dashboard: a control that
// looks like it works and does not is worse than no control.
export default function AdminSecurityAlertsPanel({ alerts, loading }: Props): React.ReactElement {
  return (
    <DashboardPanel icon={ICON_WARN} heading="Security Alerts" count={alerts.length} loading={loading}>
      <p className="text-xs text-navy-500 mb-3">
        Blacklisted visitors seen in the selected period, plus anyone overstaying right now.
      </p>
      {!loading && alerts.length === 0 && (
        <p className="text-sm text-navy-500 py-6 text-center">Nothing needs attention.</p>
      )}
      {loading && <p className="text-sm text-navy-500 py-6 text-center">Loading…</p>}
      {!loading && alerts.length > 0 && (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-warning-500/25 bg-warning-500/5 px-4 py-3"
            >
              <span className="shrink-0 w-8 h-8 rounded-full bg-warning-500/15 text-warning-600 dark:text-warning-400 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICON_WARN} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-navy-950 dark:text-white truncate">
                    {KIND_LABEL[a.kind]} — {a.title}
                  </span>
                  <span className="shrink-0 text-xs text-navy-500 tabular-nums">
                    {new Date(a.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <span className="block text-sm text-navy-700 mt-0.5">{a.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
