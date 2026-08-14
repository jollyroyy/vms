import React, { useMemo } from 'react';

import type { ReportVisit } from '../../lib/reportRow';

// The check-in frame of the Live Queue page (reference screen 2), left to
// right per the approved frame: column 1 = Check-In Details card, column 2 =
// the visitor's gate photo with the green "Identity verified" ring + the
// 4-step tracker (Photo → ID Scan → Host Notified → Print Badge), column 3 =
// the Steps rail with the white VISITOR PASS badge preview, the blue Print
// Badge button and the Back to Queue button.

type Step = { label: string; done: boolean };

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

type CheckInFrameProps = {
  activeVisit: ReportVisit;
  qrDataUrl: string | null;
  onNotifyHost: (v: ReportVisit) => void;
  onPrintBadge: () => void;
  onClose: () => void;
};

export default function CheckInFrame({
  activeVisit,
  qrDataUrl,
  onNotifyHost,
  onPrintBadge,
  onClose,
}: CheckInFrameProps): React.ReactElement {
  const steps: Step[] = useMemo(() => {
    // Photo + ID scan live inside the check-in flow; once that flow completes
    // the visit moves to checked_in and Photo/ID Scan/Print Badge are done.
    // Host Notified is true only after the guard taps Notify Host (recorded as
    // a remarks marker that nothing else writes, so it can be trimmed).
    return [
      { label: 'Photo', done: Boolean(activeVisit.photo_data) },
      { label: 'ID Scan', done: Boolean(activeVisit.visitor?.id_type) },
      { label: 'Host Notified', done: (activeVisit.remarks ?? '').includes(' - host notified on arrival') },
      { label: 'Print Badge', done: activeVisit.status === 'checked_in' },
    ];
  }, [activeVisit]);

  const stepCircle = (i: number, done: boolean, pending: boolean) =>
    done
      ? 'bg-success-500 text-white border-success-500'
      : pending
        ? 'border-brand-500 text-brand-500 dark:text-brand-400'
        : 'border-navy-300 text-navy-400 dark:border-navy-500 dark:text-navy-500';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Column 1 — Check-In Details */}
      <div className="xl:col-span-3 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
        <h3 className="font-display text-base font-semibold text-brand-500 mb-4">Check-In Details</h3>
        <div className="space-y-3">
          {[
            { label: 'Visitor', value: activeVisit.visitor?.full_name ?? '—' },
            { label: 'Company', value: activeVisit.visitor?.vendor_name ?? '—' },
            { label: 'Purpose', value: activeVisit.purpose ?? '—' },
            { label: 'Host', value: activeVisit.host?.full_name ?? activeVisit.department?.name ?? '—' },
          ].map((row) => (
            <div key={row.label}>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-navy-500 dark:text-navy-400 mb-1">{row.label}</label>
              <input
                readOnly
                value={row.value}
                className="w-full rounded-lg border border-surface-200/60 dark:border-white/[0.08] bg-surface-100/50 dark:bg-white/[0.04] px-3 py-2 text-sm text-navy-950 dark:text-navy-100"
              />
            </div>
          ))}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-navy-500 dark:text-navy-400 mb-1">Badge type</label>
            <select
              disabled
              value="temporary-day-pass"
              className="w-full rounded-lg border border-surface-200/60 dark:border-white/[0.08] bg-surface-100/50 dark:bg-white/[0.04] px-3 py-2 text-sm text-navy-950 dark:text-navy-100">
              <option value="temporary-day-pass">Temporary — Day Pass</option>
            </select>
          </div>
          <div className="pt-3 border-t border-surface-200/60 dark:border-white/[0.07]">
            <button
              onClick={() => void onNotifyHost(activeVisit)}
              disabled={activeVisit.status === 'checked_in'}
              className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors shadow-glow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              Notify Host
            </button>
          </div>
        </div>
      </div>

      {/* Column 2 — Photo + identity + step tracker */}
      <div className="xl:col-span-5 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-6 shadow-glow-sm flex flex-col items-center">
        <div className="relative w-52 h-52 rounded-full p-1.5" style={{ background: 'conic-gradient(from 0deg, #22c55e, #16a34a, #22c55e)' }}>
          <div className="w-full h-full rounded-full overflow-hidden bg-surface-100 dark:bg-white/[0.04] flex items-center justify-center">
            {activeVisit.photo_data ? (
              <img src={activeVisit.photo_data} alt={activeVisit.visitor?.full_name ?? 'Visitor'} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-4xl text-navy-400 dark:text-navy-500">{initialsOf(activeVisit.visitor?.full_name)}</span>
            )}
          </div>
        </div>
        <p className="mt-5 flex items-center gap-2 text-lg font-semibold text-success-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Identity verified
        </p>

        {/* Step tracker with connecting line */}
        <div className="w-full mt-8">
          <div className="relative flex items-center justify-between">
            <span className="absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 bg-surface-200/70 dark:bg-white/[0.1]" aria-hidden="true" />
            <span
              className="absolute left-6 top-1/2 h-0.5 -translate-y-1/2 bg-success-500 transition-all"
              style={{ width: `${Math.max(0, steps.filter((s) => s.done).length * 33)}%`, maxWidth: '100%' }}
              aria-hidden="true"
            />
            {steps.map((s, i) => (
              <span key={s.label} className="relative z-10 flex flex-col items-center gap-2">
                <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold ${stepCircle(i, s.done, i === steps.findIndex((x) => !x.done))}`}>
                  {s.done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="text-xs font-medium text-navy-950 dark:text-white whitespace-nowrap">{s.label}</span>
                <span className={`text-[11px] font-semibold ${s.done ? 'text-success-500' : 'text-brand-500 dark:text-brand-400'}`}>
                  {s.done ? 'Done' : 'Pending'}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Column 3 — Steps rail + badge */}
      <div className="xl:col-span-4 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
        <h3 className="font-display text-base font-semibold text-brand-500 mb-4">Steps</h3>

        <div id="vms-print-badge" className="rounded-xl bg-white p-4">
          <div className="flex flex-col items-center gap-1 pb-3 border-b-4 border-brand-600">
            <span className="text-brand-600">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14h-4v-6H7v6H3zm6-2h6v-4H9v4zM5 5h14v2H5V5z" />
              </svg>
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-navy-800">Visitor Pass</p>
            <p className="text-[9px] text-navy-500 font-mono tracking-wider">{activeVisit.ref_number}</p>
          </div>
          <div className="flex flex-col items-center gap-2 pt-3">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand-500/30 flex items-center justify-center">
              {activeVisit.photo_data ? (
                <img src={activeVisit.photo_data} alt={activeVisit.visitor?.full_name ?? 'Visitor'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-navy-400">{initialsOf(activeVisit.visitor?.full_name)}</span>
              )}
            </div>
            <p className="font-display font-bold text-navy-900 text-base leading-tight text-center">
              {activeVisit.visitor?.full_name ?? 'Visitor'}
            </p>
            <p className="text-[12px] font-bold text-brand-600">Day Pass #{activeVisit.ref_number.slice(-4)}</p>
            <p className="text-[11px] text-navy-500">Valid until 06:00 PM</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" className="mt-1 w-24 h-24" />
            ) : (
              <div className="mt-1 w-24 h-24 border-2 border-navy-800 rounded flex items-center justify-center text-xs text-navy-400">QR</div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={onPrintBadge}
            className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors shadow-glow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034V3.375m-10.5 3.659V3.375" />
            </svg>
            Print Badge
          </button>
          <p className="text-[10px] text-navy-400 dark:text-navy-500 text-center leading-snug">
            Pass is issued after the visitor scans their pass — printing is optional.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-surface-200/60 dark:border-white/[0.12] text-navy-700 dark:text-navy-200 hover:bg-surface-100/70 dark:hover:bg-white/[0.05] font-semibold text-sm px-4 py-2.5 transition-colors">
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
}
