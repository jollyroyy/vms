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
// select with one option, which was never a choice), and the one thing the
// table does NOT carry — the vehicle number — moved into the identity column
// below, so nothing was lost with the card.
//
// THERE IS NO "NOTIFY HOST" BUTTON (removed 2026-08-15, client instruction).
// The host is notified AUTOMATICALLY, by the check-in itself: every path that
// writes `status = 'checked_in'` calls `lib/notifyHostCheckIn.ts`, which
// inserts one `visitor_checked_in` row addressed to `visits.host_id` — the
// person who booked the visitor, in their own department — and it lands in
// that host's bell dropdown. A manual button on top of that could only ever do
// one of two things: nothing (the notice already exists, and the function is
// idempotent), or re-raise a read notice about a visitor who may have gone
// home. Neither is an action worth a control at the gate. The step tracker's
// "Host Notified" step stays, because it REPORTS the automatic notice rather
// than offering to repeat it.

type Step = { label: string; done: boolean };

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

type CheckInFrameProps = {
  activeVisit: ReportVisit;
  qrDataUrl: string | null;
  onPrintBadge: () => void;
  onClose: () => void;
  /** Log this visitor's exit. Threaded straight through to the badge rail. */
  onCheckOut?: () => void;
  /** Start this visitor's check-in. Threaded through to the badge rail; only
   *  Find & Scan passes it, because only that surface can reach a visitor who
   *  has not come through the gate yet (client instruction, 2026-08-18). */
  onCheckIn?: () => void;
  /** Overrides the rail's last button, which reads "Back to Queue" here. */
  backLabel?: string;
};

export default function CheckInFrame({
  activeVisit,
  qrDataUrl,
  onPrintBadge,
  onClose,
  onCheckOut,
  onCheckIn,
  backLabel,
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
        : 'border-navy-500 text-navy-700';

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
              <span className="font-display text-4xl text-navy-700">{initialsOf(activeVisit.visitor?.full_name)}</span>
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

        {/* The one thing the Entry & Exit table above does not carry. */}
        <div className="w-full mt-6 pt-5 border-t border-surface-200/60 dark:border-white/[0.07] flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-navy-700">Vehicle</span>
          <span className="flex-1 min-w-0 text-sm font-medium text-navy-950 dark:text-white break-words">
            {activeVisit.visitor?.vehicle_number ?? '—'}
          </span>
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
        onCheckIn={onCheckIn}
        backLabel={backLabel}
      />
    </div>
  );
}
