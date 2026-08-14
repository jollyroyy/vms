import React from 'react';

import { Link } from 'react-router-dom';

import type { ReportVisit } from '../../lib/reportRow';

// ID Verification card from the guard dashboard (reference screen 1):
// the first approved visitor not yet scanned today, shown with their
// capture photo (or initials fallback), purpose + department, an
// "AWAITING ID SCAN" status pill, and the Verify ID / Deny Entry actions.

type IdVerificationCardProps = {
  idTarget: ReportVisit | null;
  initialsOf: (name: string | null | undefined) => string;
};

export default function IdVerificationCard({ idTarget, initialsOf }: IdVerificationCardProps): React.ReactElement {
  return (
    <div className="xl:col-span-2 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-brand-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.79 3.752 3.752 0 016.338 0z" />
          </svg>
        </span>
        <h2 className="font-display text-h2 text-navy-950 dark:text-white">ID Verification</h2>
      </div>

      {idTarget ? (
        <div className="flex gap-4">
          <div className="shrink-0 w-36 rounded-xl overflow-hidden border border-surface-200/60 dark:border-white/[0.08] bg-surface-100/70 dark:bg-white/[0.04] flex items-center justify-center aspect-[3/4]">
            {idTarget.photo_data ? (
              <img src={idTarget.photo_data} alt={idTarget.visitor?.full_name ?? 'Visitor'} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-3xl text-navy-400 dark:text-navy-500">{initialsOf(idTarget.visitor?.full_name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold text-navy-950 dark:text-white leading-tight">
              {idTarget.visitor?.full_name ?? 'Unknown Visitor'}
            </p>
            <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">
              {idTarget.purpose}{idTarget.department?.name ? ` — ${idTarget.department.name} Dept` : ''}
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-500 dark:text-navy-400 mb-1.5">Status</p>
              <span className="inline-block text-xs font-bold uppercase tracking-wider rounded-md px-2.5 py-1.5 bg-warning-500/15 text-warning-400 border border-warning-400/30">
                Awaiting ID Scan
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to={`/guard/inside-now?verify=${idTarget.id}`}
                className="text-center rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors shadow-glow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.79 3.752 3.752 0 016.338 0z" />
                </svg>
                Verify ID
              </Link>
              <Link
                to="/guard/dashboard"
                className="text-center rounded-xl border border-danger-500/40 text-danger-400 hover:bg-danger-500/10 font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Deny Entry
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-navy-400 dark:text-navy-500 text-sm">No visitor awaiting ID verification right now.</p>
        </div>
      )}
    </div>
  );
}
