import React, { useMemo } from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import CheckInBadgeRail from './CheckInBadgeRail';
import CheckInTimeline from './CheckInTimeline';

// The check-in frame of the Inside Now page, in two columns: left = the
// visitor's gate photo with the identity ring, the 3-step tracker
// (Photo → ID Scan → Host Notified) and the visit timeline; right = the white
// VISITOR PASS badge preview with Check Out, Print Badge and Back to Queue.
//
// THERE IS NO "Check-In Details" CARD (removed 2026-08-15, client instruction).
// It listed Visitor Name, Company, Purpose and Host — the exact four columns
// the Inside Now table directly above this frame already prints, on the row the
// guard clicked to open it. That is the duplicate-render rule this repo has
// applied everywhere else: the same value twice on one screen makes the eye
// check whether the two agree. The Badge type control went with it (a disabled
// select with one option, which was never a choice), and the two things the
// table does NOT carry — the vehicle number and the Notify Host action — moved
// into the identity column below, so nothing was lost with the card.

type Step = { label: string; done: boolean };

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

type CheckInFrameProps = {
  activeVisit: ReportVisit;
  qrDataUrl: string | null;
  onNotifyHost: (v: ReportVisit) => void;
  onPrintBadge: () => void;
  onClose: () => void;
  /** Log this visitor's exit. Threaded straight through to the badge rail. */
  onCheckOut?: () => void;
};

export default function CheckInFrame({
  activeVisit,
  qrDataUrl,
  onNotifyHost,
  onPrintBadge,
  onClose,
  onCheckOut,
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

  const stepCircle = (done: boolean, pending: boolean) =>
    done
      ? 'bg-success-500 text-white border-success-500'
      : pending
        ? 'border-brand-500 text-brand-500 dark:text-brand-400'
        : 'border-navy-300 text-navy-400 dark:border-navy-500 dark:text-navy-500';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Column 1 — photo, identity, step tracker, visit timeline */}
      <div className="xl:col-span-7 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-6 shadow-glow-sm flex flex-col items-center">
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
                <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold ${stepCircle(s.done, i === steps.findIndex((x) => !x.done))}`}>
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

        <CheckInTimeline visit={activeVisit} />

        {/* The two things the Inside Now table above does not carry. The
            vehicle number is a fact only this frame holds; Notify Host is an
            action, and an action was never a duplicate of a table cell. */}
        <div className="w-full mt-6 pt-5 border-t border-surface-200/60 dark:border-white/[0.07] flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-navy-500 dark:text-navy-400">Vehicle</span>
          <span className="flex-1 min-w-0 text-sm font-medium text-navy-950 dark:text-white break-words">
            {activeVisit.visitor?.vehicle_number ?? '—'}
          </span>
          <button
            onClick={() => void onNotifyHost(activeVisit)}
            // Enabled for someone who IS inside; disabled once they have left.
            // This test was INVERTED, and both halves were wrong on the Entry &
            // Exit tab where the frame lives: every row in the Checked In lane
            // is `checked_in`, so the button was dead for every visitor it
            // could help with, while in the Checked Out lane it was live and
            // would insert a notification reading "<name> has checked in at the
            // gate" about a visitor who had already gone home.
            disabled={activeVisit.status !== 'checked_in'}
            className="rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors shadow-glow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Notify Host
          </button>
        </div>
      </div>

      {/* Column 2 — the white printable pass (no step list; the tracker beside
          it is the one place the stages are shown) */}
      <CheckInBadgeRail
        activeVisit={activeVisit}
        qrDataUrl={qrDataUrl}
        onPrintBadge={onPrintBadge}
        onClose={onClose}
        onCheckOut={onCheckOut}
      />
    </div>
  );
}
