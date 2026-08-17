// The gate check-in for a walk-in the host has already cleared: the visitor
// card number and the carrying declaration, and nothing else.
//
// IT ASKS FOR NO PHOTO AND NO ID SCAN (client instruction, 2026-08-17). Both
// were already taken at registration — WalkInRequest refuses to submit without
// a scan and a photo, uploads the photo BEFORE inserting the visit row, and
// writes id_type/id_last4 onto the visitor — so this desk was making the same
// person face the same camera twice, minutes apart, for a record the row
// already carries. What is on file is SHOWN here instead, as a read-only
// confirmation line built from the row itself: no claim is made about a photo
// or a document that is not actually there (the no-fabricated-facts rule).
//
// The one thing registration cannot know is which physical card gets handed
// over at the gate, so that is the one field left, and it is still mandatory
// (migration 076 demands it back at check-out).
//
// It was inline in GuardWalkInApproved until 2026-08-17, when the client asked
// for the same control to sit on the walk-in register itself — the guard who
// raised the request is the one standing in front of the visitor when the
// answer comes back, and sending them to a different tab to act on it was the
// complaint. Two copies of a form that ends in a status write is exactly the
// drift lib/checkInWalkInApproved.ts exists to prevent one layer down, so the
// form moved out here rather than being pasted onto the second screen.
//
// It owns the CAPTURE state only. The write stays in the parent's onConfirm,
// which routes to lib/checkInWalkInApproved — this file never touches supabase.
import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import { isValidCardNumber } from '../../lib/cardNumber';
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  visit: Visit;
  /** True while the parent's write is in flight for THIS row. */
  busy: boolean;
  onConfirm: (details: WalkInCheckIn) => void;
  onCancel: () => void;
};

export default function WalkInCheckInForm({ visit: v, busy, onConfirm, onCancel }: Props): React.ReactElement {
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');

  const cardBad = !isValidCardNumber(cardNumber);
  const canConfirm = !cardBad && !busy;

  // Why Confirm Check In is refused, in one line — same rule as
  // CheckInPhotoStep. There is only one requirement left, but a greyed-out
  // button with nothing saying why is what this desk cannot afford.
  const blockedReason = cardBad ? 'Enter the visitor card number before checking in.' : '';

  // What registration already put on the row. Each line renders only if the
  // record actually holds it — an unconditional "Identity verified" would be a
  // claim the system cannot stand behind.
  const hasPhoto = Boolean(v.photo_data || v.photo_path);
  const idType = v.visitor?.id_type ?? null;
  const idLast4 = v.visitor?.id_last4 ?? null;
  const onFile: string[] = [];
  if (hasPhoto) onFile.push('Photo taken at registration');
  if (idType) onFile.push(`ID recorded — ${idType}${idLast4 ? ` •••• ${idLast4}` : ''}`);

  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-5 mt-2 shadow-sm border border-surface-100 dark:border-white/[0.07] space-y-4">
      {onFile.length > 0 && (
        <div className="rounded-xl bg-success-50 border border-success-200 dark:border-success-500/25 px-4 py-2.5 text-sm space-y-1">
          {onFile.map((line) => (
            <p key={line} className="flex items-start gap-2 font-semibold text-success-700">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="break-words">{line}</span>
            </p>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] p-3.5 space-y-2">
        <label htmlFor={`walkin-card-${v.id}`} className="block">
          <span className="block text-sm font-bold text-navy-800 dark:text-white">Visitor card number *</span>
          <span className="block text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">
            The number printed on the physical card handed to the visitor. It must be returned at check-out.
          </span>
        </label>
        <input
          id={`walkin-card-${v.id}`}
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="e.g. C-104"
          maxLength={20}
          aria-invalid={cardBad && cardNumber !== ''}
          aria-describedby={`walkin-card-hint-${v.id}`}
          className="input w-full"
        />
        {/* Only once something has been TYPED. An empty field is not yet a
            mistake, and painting the box red the moment the form opens spent the
            one error colour on the normal case; the outstanding-requirement line
            above the buttons is what names an untouched field. */}
        {cardBad && cardNumber !== '' && (
          <p id={`walkin-card-hint-${v.id}`} className="text-[11px] text-danger-600 font-semibold">
            Letters, digits and hyphens only — e.g. C-104.
          </p>
        )}
      </div>

      {/* A tick box, never inferred from whether remarks were typed — an empty
          box must mean "carrying nothing", not "the guard was interrupted".
          Unticking discards the text so no orphaned description survives on a
          visit flagged as carrying nothing. It stays on this form because it is
          the one fact only the gate can see: registration always writes false. */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={carrying}
          onChange={(e) => { setCarrying(e.target.checked); if (!e.target.checked) setRemarks(''); }}
          className="h-4 w-4 rounded accent-brand-500"
        />
        <span className="text-sm font-semibold text-navy-700">Carrying material</span>
      </label>
      {carrying && (
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="What are they carrying?"
          className="input"
        />
      )}

      {blockedReason && (
        <p className="text-xs font-semibold text-danger-600" role="status">{blockedReason}</p>
      )}

      <div className="flex gap-2.5">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-surface-200 bg-surface-50 text-navy-500 hover:bg-surface-100 py-2.5 text-sm font-semibold transition-all">
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => { if (canConfirm) onConfirm({ carrying, remarks, cardNumber }); }}
          className="btn-accent flex-1 !py-2.5 disabled:opacity-50"
        >
          {busy ? 'Checking in…' : 'Confirm Check In'}
        </button>
      </div>
    </div>
  );
}
