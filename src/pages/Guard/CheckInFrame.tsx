import React, { useMemo } from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import CheckInBadgeRail from './CheckInBadgeRail';

// The check-in frame of the Live Queue page (reference screen 2), left to
// right per the approved frame: column 1 = Check-In Details card, column 2 =
// the visitor's gate photo with the green "Identity verified" ring + the
// 3-step tracker (Photo → ID Scan → Host Notified), column 3 =
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
    // Three steps only: Photo → ID Scan → Host Notified. Print Badge was
    // removed from the timeline (user request) — it is the optional button in
    // the right-hand pass column, so it is never framed as mandatory.
    //
    // Host Notified is `status === 'checked_in'`, full stop. It used to ALSO
    // accept a ' - host notified on arrival' substring inside `visits.remarks`,
    // written by the Notify Host button. Nothing writes that marker any more —
    // Notify Host now inserts a real row in `notifications` — and reading a
    // flag out of a prose column another role writes was never sound. Every
    // check-in path already notifies the host (lib/checkInFlow.ts), so a
    // checked-in visit IS a notified host.
    const hostNotified = activeVisit.status === 'checked_in';
    return [
      { label: 'Photo', done: Boolean(activeVisit.photo_data) },
      { label: 'ID Scan', done: Boolean(activeVisit.visitor?.id_type) },
      { label: 'Host Notified', done: hostNotified },
    ];
  }, [activeVisit]);

  // "Identity verified" used to render unconditionally — the frame claimed a
  // fact it had no evidence for. It is only true once the two checks that
  // actually establish identity (the gate photo and the scanned ID) are both
  // done; reuse the same evidence the step tracker below already computed.
  const identityVerified = Boolean(activeVisit.photo_data) && Boolean(activeVisit.visitor?.id_type);

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
        <div className="space-y-4">
          {[{
            // "Visitor Name" is the one spelling this app uses for a visitor's
            // name on every screen — see tests/unit/visitorNameLabel.test.ts,
            // which fails on the older wording reappearing anywhere under src/.
            label: 'Visitor Name',
            value: activeVisit.visitor?.full_name ?? '—',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            ),
          }, {
            label: 'Company',
            value: activeVisit.visitor?.vendor_name ?? '—',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            ),
          }, {
            label: 'Purpose',
            value: activeVisit.purpose ?? '—',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            ),
          }, {
            label: 'Host',
            value: activeVisit.host?.full_name ? `${activeVisit.host.full_name} · ${activeVisit.department?.name ?? ''}`.trim().replace(/ · $/, '') : (activeVisit.department?.name ?? '—'),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            ),
          }, {
            label: 'Vehicle',
            // The vehicle number alone. There is no parking-allocation table
            // anywhere in the schema, so "(parking slot B-12)" was a made-up
            // slot printed on a security screen as if it were assigned data.
            value: activeVisit.visitor?.vehicle_number ?? '—',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            ),
          }].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="flex-shrink-0 w-9 h-9 rounded-lg border border-surface-200/60 dark:border-white/[0.1] bg-surface-100/50 dark:bg-white/[0.04] flex items-center justify-center text-brand-500 dark:text-brand-400" aria-hidden="true">
                {row.icon}
              </span>
              <label className="w-20 text-sm font-medium text-navy-500 dark:text-navy-300 whitespace-nowrap">{row.label}</label>
              {/* A DIV, not a readOnly <input>. An input is a single-line box:
                  anything wider than it — "Whitfield & Partners", a host with
                  their department after it — was silently clipped with no
                  scrollbar and no ellipsis, so the guard could not tell a
                  truncated value from a complete one. These fields are read-only
                  facts, never edited here, so the input bought nothing and cost
                  the one thing this card is for. Same border, background,
                  padding and type scale, so the card looks unchanged; the value
                  now wraps onto a second line instead of disappearing. */}
              <div
                title={row.value}
                className="flex-1 min-w-0 rounded-lg border border-surface-200/60 dark:border-white/[0.1] bg-surface-100/50 dark:bg-white/[0.04] px-3 py-2 text-sm font-medium text-white dark:text-white break-words">
                {row.value}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-lg border border-surface-200/60 dark:border-white/[0.1] bg-surface-100/50 dark:bg-white/[0.04] flex items-center justify-center text-brand-500 dark:text-brand-400" aria-hidden="true">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </span>
            <label className="w-20 text-sm font-medium text-navy-500 dark:text-navy-300 whitespace-nowrap">Badge type</label>
            <select
              disabled
              value="temporary-day-pass"
              className="flex-1 min-w-0 rounded-lg border border-surface-200/60 dark:border-white/[0.1] bg-surface-100/50 dark:bg-white/[0.04] px-3 py-2 text-sm font-medium text-white dark:text-white">
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
        <div
          // The ring used to be a green conic-gradient unconditionally, whether
          // or not identity was actually verified. Verified = Photo AND ID Scan
          // both done, matching the evidence the step tracker below already
          // has. Anything less is not verified, so the ring must not read
          // green — falls back to the same neutral token the rest of the guard
          // surface uses for "not yet" (bg-navy-300 / dark:bg-navy-500).
          className={`relative w-52 h-52 rounded-full p-1.5 ${identityVerified ? '' : 'bg-navy-300 dark:bg-navy-500'}`}
          style={identityVerified ? { background: 'conic-gradient(from 0deg, #22c55e, #16a34a, #22c55e)' } : undefined}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-surface-100 dark:bg-white/[0.04] flex items-center justify-center">
            {activeVisit.photo_data ? (
              <img src={activeVisit.photo_data} alt={activeVisit.visitor?.full_name ?? 'Visitor'} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-4xl text-navy-400 dark:text-navy-500">{initialsOf(activeVisit.visitor?.full_name)}</span>
            )}
          </div>
        </div>
        <p className={`mt-5 flex items-center gap-2 text-lg font-semibold ${identityVerified ? 'text-success-500' : 'text-warning-400'}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {identityVerified ? 'Identity verified' : 'Identity not verified'}
        </p>

        {/* Step tracker with connecting line */}
        <div className="w-full mt-8">
          <div className="relative flex items-center justify-between">
            <span className="absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 bg-surface-200/70 dark:bg-white/[0.1]" aria-hidden="true" />
            <span
              className="absolute left-6 top-1/2 h-0.5 -translate-y-1/2 bg-success-500 transition-all"
              style={{ width: `${Math.max(0, steps.filter((s) => s.done).length * 49)}%`, maxWidth: 'calc(100% - 3rem)' }}
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

      {/* Column 3 — the white printable pass (no step list; the middle
          column's tracker is the one place the stages are shown) */}
      <CheckInBadgeRail
        activeVisit={activeVisit}
        qrDataUrl={qrDataUrl}
        onPrintBadge={onPrintBadge}
        onClose={onClose}
      />
    </div>
  );
}
