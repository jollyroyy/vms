import React from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import { formatDateTime } from '../../lib/formatDate';

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

// THERE IS NO PHOTO ON THE PRINTED PASS (client instruction, 2026-08-16). The
// headshot was the largest element on the card and the least useful thing on
// it: the guard printing the pass has just met the person, and the QR is what
// anybody downstream actually resolves the visitor by. Removing it is what
// leaves room for the two facts the pass was missing — who the visitor is here
// to see, and which department that person belongs to — without the card
// spilling onto a second sheet.
//
// The initials fallback went with it. A grey monogram in a blue ring is a
// placeholder for a photo; with no photo on the card there is nothing to hold
// a place for.

// THERE IS NO "VALID UNTIL" LINE (client instruction, 2026-08-15). The pass is
// handed to somebody who is already inside, and its expiry is enforced by the
// QR gate against `qr_expires_at` whatever the paper says — so the deadline was
// the one fact on the card nobody could act on. What a guard reading a pass
// back actually asks is when the visit was booked for and when the person came
// through the gate, which is what these lines carry instead.
//
// formatDateTime, never a local toLocaleString: it pins IST and prints the same
// shape PreApprovalPass and the visit timeline use, so three copies of one
// visit's clock cannot disagree. Every time on this pass is DATE AND TIME — a
// pass can outlive the day it was printed on, and "03:30" on a card found the
// next morning says when but not whether that when was today.

/** One label/value line on the pass. */
function PassLine({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span style={{ color: PASS_MUTED }} className="text-[9px] font-bold uppercase tracking-[0.14em] shrink-0">
        {label}
      </span>
      <span style={{ color: PASS_INK }} className="text-[11px] font-semibold text-right break-words">
        {value}
      </span>
    </div>
  );
}

type CheckInBadgeRailProps = {
  activeVisit: ReportVisit;
  qrDataUrl: string | null;
  onPrintBadge: () => void;
  onClose: () => void;
  /** Log this visitor's exit. Omitted, the rail is read-only. */
  onCheckOut?: () => void;
  /** START this visitor's check-in (client instruction, 2026-08-18: put the
   *  button here too, so the guard can admit or release straight from the
   *  record instead of going back to the list).
   *
   *  Passed only by Find & Scan, whose search can land on a visitor who has
   *  not arrived yet — every row Entry & Exit opens is already through the
   *  gate. It never WRITES: it hands the guard to `CheckInPhotoStep`, so the
   *  photo, the mandatory ID scan and the card number are all still collected
   *  by the one flow that collects them everywhere else. */
  onCheckIn?: () => void;
  /** What the last button says. "Back to Queue" on Entry & Exit, whose frame
   *  sits under a queue; Find & Scan sends the guard back to search results. */
  backLabel?: string;
};

export default function CheckInBadgeRail({
  activeVisit,
  qrDataUrl,
  onPrintBadge,
  onClose,
  onCheckOut,
  onCheckIn,
  backLabel = 'Back to Queue',
}: CheckInBadgeRailProps): React.ReactElement {
  const name = activeVisit.visitor?.full_name ?? 'Visitor';
  const phone = activeVisit.visitor?.phone?.trim();

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
          <p style={{ color: PASS_INK }} className="font-display font-bold text-xl leading-tight text-center">{name}</p>
          <p style={{ color: PASS_BLUE }} className="mt-1.5 text-base font-bold">Day Pass #{activeVisit.ref_number.slice(-4)}</p>
          {/* THE PHYSICAL CARD, exactly as the guard typed it (client
              instruction, 2026-08-15). `visitor_card_number` is the number
              printed on the plastic card handed over at check-in, and the pass
              is the one piece of paper that travels with the visitor — so it is
              the only place the plastic and the record can be checked against
              each other, which is the whole point of demanding the card back at
              check-out. Printed verbatim, never sliced: unlike "Day Pass
              #{last 4 of ref}", a partial card number matches the wrong card.
              Omitted entirely when the visit has none (a row written before
              migration 076); a "Card —" line would read as a card issued and
              not recorded. */}
          {activeVisit.visitor_card_number && (
            <p style={{ color: PASS_INK }} className="mt-1.5 text-sm font-bold tracking-wide">
              Card No. {activeVisit.visitor_card_number}
            </p>
          )}
          {/* Everything a guard reads off a pass, on the pass — one block, one
              column (client instruction, 2026-08-15). It used to take three
              screens to answer "who is this, how do I reach them, and when were
              they due": the mobile number was only on the popup, the times only
              on the frame's timeline, and the card itself carried a deadline
              nobody could act on. One column rather than two because at this
              width a "14 Aug 2026, 10:30 am" value cannot share a line and stay
              unclipped — and a clipped date is indistinguishable from a
              complete one. */}
          <div className="mt-3 w-full" style={{ borderTop: '1px solid #e6e8ee' }}>
            {phone && <PassLine label="Mobile" value={phone} />}
            {/* WHO THIS VISIT IS FOR, on the pass itself (client instruction,
                2026-08-16). Until now the host and their department were only
                on the Entry & Exit row and the visitor popup — never on the
                piece of paper that travels with the visitor — so a pass found
                on a corridor floor named the visitor and nothing about where
                they were supposed to be. `host` is filled by `attachHostNames`
                on the same hooks that feed this frame, so no extra query.
                Both lines render only when known: a "Person to Meet —" row
                claims the field was left blank, when the truth is that a
                walk-in registered at the gate may genuinely not have one yet. */}
            {activeVisit.host?.full_name && (
              <PassLine label="Person to Meet" value={activeVisit.host.full_name} />
            )}
            {activeVisit.department?.name && (
              <PassLine label="Department" value={activeVisit.department.name} />
            )}
            {/* A walk-in has no slot: "Anytime", never a dash. Nobody booked
                them a time, which is not the same as a time going unrecorded. */}
            <PassLine
              label="Scheduled"
              value={activeVisit.scheduled_for ? formatDateTime(activeVisit.scheduled_for) : 'Anytime'}
            />
            {activeVisit.checked_in_at && (
              <PassLine label="Checked in" value={formatDateTime(activeVisit.checked_in_at)} />
            )}
            {/* Only once they have actually left. On a visitor still inside
                this row would be a claim about where they went — the same rule
                that keeps `exit_verified` honest. */}
            {activeVisit.checked_out_at && (
              <PassLine label="Checked out" value={formatDateTime(activeVisit.checked_out_at)} />
            )}
          </div>
          {/* Bigger now the photo is gone, and it earns the space: with no
              headshot on the card the QR is the only thing on the pass a
              machine can read, and it has to scan off paper that has been
              folded into a pocket. `id` so the print sheet can scale it to the
              page without guessing at a selector. */}
          {qrDataUrl ? (
            <img id="vms-print-badge-qr" src={qrDataUrl} alt="QR code" className="mt-4 w-[150px] h-[150px]" />
          ) : (
            <div
              id="vms-print-badge-qr"
              style={{ ...WHITE, borderColor: '#d9dde5', color: '#8b93a5' }}
              className="mt-4 w-[150px] h-[150px] border-2 rounded-lg flex items-center justify-center text-xs font-bold">
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
        {/* Only ever one of the two: a visitor is either outside and due in,
            or inside and due out. Check In leads for the same reason Check Out
            does — it is the thing on this rail that changes the visit. */}
        {onCheckIn && (
          <button
            onClick={onCheckIn}
            className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-4 py-2.5 flex items-center justify-center gap-2 transition-colors shadow-glow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
            </svg>
            Check In
          </button>
        )}
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
        <p className="text-[10px] text-navy-700 text-center leading-snug">
          Pass is issued after the visitor scans their pass — printing is optional.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl border border-surface-200/60 dark:border-white/[0.12] text-navy-800 hover:bg-surface-100/70 dark:hover:bg-white/[0.05] font-semibold text-sm px-4 py-2.5 transition-colors">
          {backLabel}
        </button>
      </div>
    </div>
  );
}
