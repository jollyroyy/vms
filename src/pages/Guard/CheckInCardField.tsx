// The visitor card number field, and the one sentence that says why a number
// cannot be used.
//
// Split out of CheckInPhotoStep when the availability check landed (2026-08-18)
// — that file is the STEP, and the 300-line cap is the forcing function that
// keeps a step from also being a field. Presentational on purpose: the lookup
// lives in the parent beside the other check-in blockers, so exactly one place
// decides whether Check In may be pressed.
import React from 'react';
import type { CardHolder } from '../../lib/cardAssignment';
import { cardInUseMessage } from '../../lib/cardAssignment';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Typed, but not letters/digits/hyphens (migration 076's CHECK, mirrored in
   *  lib/cardNumber.ts). */
  invalid: boolean;
  /** Nothing typed yet. */
  missing: boolean;
  /** The open, unreturned issue of this number — null when it is free. */
  holder: CardHolder | null;
};

export default function CheckInCardField({ value, onChange, invalid, missing, holder }: Props): React.ReactElement {
  const bad = invalid || missing || holder !== null;
  const message = missing
    ? 'Enter the card number before checking in.'
    : invalid
      ? 'Letters, digits and hyphens only — e.g. C-104.'
      : holder
        ? cardInUseMessage(holder)
        : '';

  return (
    <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] p-3.5 space-y-2">
      <label htmlFor="visitor-card" className="block">
        <span className="block text-sm font-bold text-navy-800 dark:text-white">Visitor card number *</span>
        <span className="block text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">
          The number printed on the physical card handed to the visitor. It must be returned at check-out.
        </span>
      </label>
      <input
        id="visitor-card"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. C-104"
        maxLength={20}
        aria-invalid={bad}
        aria-describedby="visitor-card-hint"
        className="input w-full"
      />
      {bad && message && (
        <p id="visitor-card-hint" className="text-[11px] text-danger-600 font-semibold">{message}</p>
      )}
    </div>
  );
}
