import React from 'react';
import { exportToCsv } from '../../lib/exportUtils';
import { REPORT_BUNDLES } from '../../lib/reportBundles';
import type { ReportVisit } from '../../lib/reportRow';

type Props = {
  visits: ReportVisit[];
  from: string;
  to: string;
  filenameSuffix: string;
};

const TONE = [
  'bg-brand-500 text-white',
  'bg-success-500 text-white',
  'bg-warning-500 text-white',
  'bg-[#a855f7] text-white',
];

const ICONS = [
  'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
];

// The four standing reports, as download cards.
//
// EACH BUTTON REPORTS ITS OWN ROW COUNT AND GOES DISABLED AT ZERO. A download
// control that produces a file with a header row and nothing under it is
// indistinguishable from a broken export, and the admin only finds out after
// opening it — so the card says up front how many rows the current range
// yields. That figure comes from running the same builder the button runs, not
// from a second count.
//
// They are CSV, not PDF. `jspdf` is already a dependency (the visitor pass uses
// it), but a PDF is a fixed-width artefact and every one of these is a table an
// admin will sort and pivot — the register itself already has a Print button
// for the paper case.

export default function ReportsDownloadCards({ visits, from, to, filenameSuffix }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 no-print">
      {REPORT_BUNDLES.map((bundle, i) => {
        const rows = bundle.build(visits, from, to);
        const empty = rows.length === 0;

        return (
          <div key={bundle.key}
               className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07]
                          p-5 shadow-glow-sm flex flex-col items-center text-center">
            <span className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${TONE[i % TONE.length]}`}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[i % ICONS.length]} />
              </svg>
            </span>

            <h3 className="font-display text-h3 text-navy-950 dark:text-white">{bundle.title}</h3>
            <p className="text-xs text-navy-500 mt-1 mb-4 flex-1">{bundle.blurb}</p>

            <button
              type="button"
              disabled={empty}
              onClick={() => exportToCsv(rows, `${bundle.filename}-${filenameSuffix}.csv`)}
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline
                         disabled:text-navy-400 disabled:no-underline disabled:cursor-not-allowed
                         flex items-center gap-1.5 pt-3 border-t border-surface-200/60 dark:border-white/[0.07] w-full justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {empty ? 'Nothing in this range' : `Download report (${rows.length})`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
