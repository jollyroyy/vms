import React from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import { istDayEnd, visitMoment } from '../../lib/visitExpiry';

// Column 3 of the Live Queue check-in frame: the WHITE visitor pass, the blue
// Print Badge button, and Back to Queue. Nothing else.
//
// There is NO step list here (removed 2026-08-14, client instruction). The
// numbered rail restated, vertically, the exact same three stages the middle
// column's tracker already shows horizontally — the same fact rendered twice
// on one screen — and its fourth entry, "Print Badge / Pending", framed an
// optional printout as an unfinished step of the check-in.
//
// EVERY COLOUR ON THE PASS IS AN EXPLICIT LITERAL, never a Tailwind palette
// class. `base.css` rewrites `.dark .bg-white` to a translucent dark glass, so
// a `bg-white` card renders dark on this screen — which is exactly why the
// pass never looked white. This card is a preview of something printed on
// paper: it must show the guard what the printer will produce, regardless of
// the app's theme, so it opts out of theming entirely.

const PASS_INK = '#111827';
const PASS_BLUE = '#1d4ed8';
const PASS_MUTED = '#5a6070';
const WHITE = { backgroundColor: '#ffffff' } as const;

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

/**
 * The pass's real expiry, not a fixed "06:00 PM" printed on every pass
 * regardless of when the visit was for. `qr_expires_at` is the authority —
 * migrations 071/073 set it to `vms_day_end_ist(scheduled_for)` at approval
 * time, so it already carries the multi-day-visit exception (073) when one
 * applies. A row written before that RPC set the column, or a walk-in that
 * never had a QR expiry written at all, falls back to `expected_departure`
 * (the approver's own stated end date), and only then to the same
 * `istDayEnd` rule the sweep and `isVisitExpired` use — the day containing
 * the visit's moment, ending at mall close (22:00 IST), never midnight.
 */
function passValidUntil(v: ReportVisit): string {
  const iso = v.qr_expires_at ?? v.expected_departure ?? istDayEnd(new Date(visitMoment(v))).toISOString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

type CheckInBadgeRailProps = {
  activeVisit: ReportVisit;
  qrDataUrl: string | null;
  onPrintBadge: () => void;
  onClose: () => void;
  /** Log this visitor's exit. Omitted, the rail is read-only. */
  onCheckOut?: () => void;
};

export default function CheckInBadgeRail({
  activeVisit,
  qrDataUrl,
  onPrintBadge,
  onClose,
  onCheckOut,
}: CheckInBadgeRailProps): React.ReactElement {
  const photo = activeVisit.photo_data;
  const name = activeVisit.visitor?.full_name ?? 'Visitor';

  return (
    <div className="xl:col-span-5 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
      {/* The pass, laid out exactly as the reference card: dark lanyard notch ·
          logo mark beside the issuing wordmark · FULL-BLEED blue VISITOR PASS
          band · circular photo in a blue ring · name · blue day-pass number ·
          validity line · QR. The band runs edge to edge, so the card clips its
          children rather than padding them. */}
      <div
        id="vms-print-badge"
        style={{ ...WHITE, borderRadius: '1rem', boxShadow: '0 10px 30px -8px rgba(0,0,0,0.45)' }}
        className="mx-auto w-full max-w-[320px] overflow-hidden">
        <div className="flex flex-col items-center pt-3.5">
          <div style={{ backgroundColor: PASS_INK }} className="w-[86px] h-3.5 rounded-full" aria-hidden="true" />

          {/* Issuing company. The wordmark is Quest Mall, not the reference's
              placeholder: a visitor pass names the site that issued it, and a
              pass carrying someone else's brand is a forgery, not a mockup. */}
          <div className="mt-4 flex items-center justify-center gap-2.5 px-5">
            <img
              src="/quest-mall-logo.jpg"
              alt=""
              width={193}
              height={160}
              className="h-9 w-10 object-contain flex-shrink-0"
              draggable={false}
            />
            <span className="text-left leading-none">
              <span style={{ color: PASS_INK }} className="block font-display font-extrabold text-xl tracking-tight">
                QUEST MALL
              </span>
              <span style={{ color: PASS_MUTED }} className="block mt-1 text-[9px] font-semibold uppercase tracking-[0.18em]">
                Visitor Management
              </span>
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: PASS_BLUE }} className="mt-3.5 w-full py-2.5 text-center">
          <p style={{ color: '#ffffff' }} className="font-display font-bold tracking-[0.12em] text-lg uppercase leading-none">
            Visitor Pass
          </p>
        </div>

        <div className="flex flex-col items-center px-5 pt-4 pb-5">
          <div style={{ ...WHITE, borderColor: PASS_BLUE }} className="w-[104px] h-[104px] rounded-full overflow-hidden border-[3px] p-0.5">
            <div className="w-full h-full rounded-full overflow-hidden">
              {photo ? (
                <img src={photo} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: '#8b93a5' }} className="w-full h-full flex items-center justify-center text-xl font-bold">
                  {initialsOf(activeVisit.visitor?.full_name)}
                </span>
              )}
            </div>
          </div>
          <p style={{ color: PASS_INK }} className="mt-3 font-display font-bold text-xl leading-tight text-center">{name}</p>
          <p style={{ color: PASS_BLUE }} className="mt-1.5 text-base font-bold">Day Pass #{activeVisit.ref_number.slice(-4)}</p>
          <p style={{ color: PASS_MUTED }} className="mt-1 text-sm font-medium">Valid until {passValidUntil(activeVisit)}</p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code" className="mt-3 w-[104px] h-[104px]" />
          ) : (
            <div
              style={{ ...WHITE, borderColor: '#d9dde5', color: '#8b93a5' }}
              className="mt-3 w-[104px] h-[104px] border-2 rounded-lg flex items-center justify-center text-xs font-bold">
              QR
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {/* The exit. It leads the stack because it is the only thing on this
            screen that changes the visit — printing is optional and Back to
            Queue is navigation. /visitors/inside used to be the sole place a
            visitor could leave; with that surface retired, this is it. */}
        {onCheckOut && (
          <button
            onClick={onCheckOut}
            className="w-full rounded-xl bg-danger-600 hover:bg-danger-500 text-white font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Check Out
          </button>
        )}
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
  );
}
