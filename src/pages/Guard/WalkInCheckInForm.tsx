// The gate check-in for a walk-in the host has already cleared: photo, ID scan,
// visitor card number, carrying declaration.
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
import PhotoCapture from '../../components/PhotoCapture';
import { namesMatch } from '../../lib/ai/nameMatch';
import { isValidCardNumber } from '../../lib/cardNumber';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  visit: Visit;
  /** True while the parent's write is in flight for THIS row. */
  busy: boolean;
  onConfirm: (details: WalkInCheckIn) => void;
  onCancel: () => void;
};

export default function WalkInCheckInForm({ visit: v, busy, onConfirm, onCancel }: Props): React.ReactElement {
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<IdScanResult | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');

  const cardBad = !isValidCardNumber(cardNumber);
  const mismatch = Boolean(scanResult?.name) && !namesMatch(scanResult?.name ?? '', v.visitor?.full_name ?? '');
  const canConfirm = (): boolean => {
    if (!photoBlob || cardBad || busy) return false;
    return !mismatch;
  };

  // Why Confirm Check In is refused, in one line — same rule as
  // CheckInPhotoStep. The field hints are spread down a long card and the guard
  // is standing in front of somebody, so a greyed-out button with nothing
  // saying which requirement is outstanding is the one thing this desk cannot
  // afford. (The ID scan is NOT among the requirements here on purpose: this
  // visitor's document was read at registration and is already on the row.)
  const blockedReason = !photoBlob
    ? 'Capture the photo, then press Use Photo, before checking in.'
    : mismatch
      ? 'The scanned ID does not match the approved visitor.'
      : cardBad
        ? 'Enter the visitor card number before checking in.'
        : '';

  const scanSection = () => {
    const status = scanResult
      ? scanResult.name
        ? mismatch ? 'mismatch' : 'match'
        : 'no-name'
      : null;
    if (!scanResult) {
      return (
        <button type="button" onClick={() => setScanOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
          Scan ID card
        </button>
      );
    }
    if (status === 'match') {
      return (
        <div className="rounded-xl bg-success-50 border border-success-200 dark:border-success-500/25 px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="font-bold text-success-700">Identity verified</span>
          <span className="text-xs text-success-700 break-words">{scanResult.idType} •••• {scanResult.idLast4}</span>
        </div>
      );
    }
    if (status === 'mismatch') {
      return (
        <div className="rounded-xl bg-danger-50 border border-danger-200 dark:border-danger-500/25 px-4 py-2.5 text-sm space-y-1.5">
          <p className="font-bold text-danger-700">Name doesn't match the approved visitor</p>
          <p className="text-xs text-danger-700 break-words">Card shows {scanResult.name} — approved as {v.visitor?.full_name}</p>
          <button type="button" onClick={() => setScanResult(null)}
            className="text-xs font-bold text-danger-700 underline underline-offset-2">Discard scan</button>
        </div>
      );
    }
    return (
      <div className="rounded-xl bg-accent-50 border border-accent-200 dark:bg-accent-500/10 dark:border-accent-500/25 px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-bold text-accent-700 dark:text-accent-300">ID recorded — no name could be read</span>
        <span className="text-xs text-accent-700 dark:text-accent-300 break-words">{scanResult.idType} •••• {scanResult.idLast4}</span>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-5 mt-2 shadow-sm border border-surface-100 dark:border-white/[0.07] space-y-4">
      {scanOpen && (
        <IdScanOverlay
          onScanned={(r) => { setScanResult(r); setScanOpen(false); }}
          onClose={() => setScanOpen(false)}
        />
      )}
      {/* Same rule as CheckInPhotoStep: ONE camera at a time. This lane used to
          mount PhotoCapture underneath the open scan overlay, so the scan's rear
          camera and the photo's front camera were both live at once — the scan
          fails to start on phones, and the second feed shows through the
          translucent backdrop as what looks like a second scan page. */}
      <div>
        <p className="text-sm font-bold text-navy-950">Photo of the visitor</p>
        <p className="text-[11px] text-navy-700 mt-0.5">
          Point the camera at the visitor, not at the ID card.
        </p>
      </div>
      {!scanOpen && <PhotoCapture onCapture={setPhotoBlob} />}
      {scanSection()}

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
          visit flagged as carrying nothing. */}
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
          disabled={!canConfirm()}
          onClick={() => { if (photoBlob) onConfirm({ photoBlob, carrying, remarks, idScan: scanResult, cardNumber }); }}
          className="btn-accent flex-1 !py-2.5 disabled:opacity-50"
        >
          {busy ? 'Checking in…' : 'Confirm Check In'}
        </button>
      </div>
    </div>
  );
}
