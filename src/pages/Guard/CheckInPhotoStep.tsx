import React, { useState } from 'react';
import PhotoCapture from '../../components/PhotoCapture';
import { namesMatch } from '../../lib/ai/nameMatch';
import { isValidCardNumber } from '../../lib/cardNumber';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';
import CheckInVisitorSummary from './CheckInVisitorSummary';
import CheckInStepTracker from './CheckInStepTracker';
import CheckInScanSummary from './CheckInScanSummary';
import type { MatchItem } from './checkInTypes';

type Props = {
  selectedMatch: MatchItem;
  photoBlob: Blob | null;
  error: string;
  checkingIn: boolean;
  carrying: boolean;
  onCarryingChange: (value: boolean) => void;
  remarks: string;
  onRemarksChange: (value: string) => void;
  cardNumber: string;
  onCardNumberChange: (value: string) => void;
  onBack: () => void;
  onCapture: (blob: Blob) => void;
  onRetake: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onScanResult: (result: IdScanResult | null) => void;
  /** Raised when the guard waves a name mismatch through, so the caller can
   *  record it on the visit (`visits.id_match_overridden`, migration 097).
   *  Optional: a caller that does not persist it still gets the unblocking. */
  onOverrideChange?: (overridden: boolean) => void;
  /** Open the ID scan overlay immediately on mount instead of waiting for the
   *  guard to press "Scan ID card". The dashboard's Verify ID uses this: the
   *  guard clicked a button that promises a scan, so a scan is what opens. */
  autoScan?: boolean;
};

export default function CheckInPhotoStep({
  selectedMatch, photoBlob, error, checkingIn, carrying, onCarryingChange,
  remarks, onRemarksChange, cardNumber, onCardNumberChange, onBack, onCapture,
  onRetake, onCancel, onConfirm, onScanResult, onOverrideChange, autoScan = false,
}: Props): React.ReactElement {
  const [scanOpen, setScanOpen] = useState(autoScan);
  const [scanResult, setScanResult] = useState<IdScanResult | null>(null);
  // The guard's leniency for a refused name (client instruction, 2026-08-17).
  // Held here rather than by each caller because it belongs to the scan on
  // screen: any change to that scan must clear it, and this is the component
  // that owns the scan.
  const [overridden, setOverridden] = useState(false);

  // One place to change the scan, so an override cannot outlive the reading it
  // was granted against. A rescan that lands a DIFFERENT name would otherwise
  // arrive pre-approved by a decision the guard made about the previous one.
  const changeScan = (next: IdScanResult | null) => {
    setScanResult(next);
    onScanResult(next);
    setOverridden(false);
    onOverrideChange?.(false);
  };

  const override = () => { setOverridden(true); onOverrideChange?.(true); };

  const matchStatus = scanResult
    ? scanResult.name
      ? namesMatch(scanResult.name, selectedMatch.visitorName)
        ? 'match'
        : 'mismatch'
      : 'no-name'
    : null;

  // ID scanning is UNCONDITIONAL — there is no `ocr` flag (removed 2026-08-13,
  // same trap as `qr`: Vite inlines env vars at build time, so a flag whose
  // off-state ships a dead button is a liability, not a safeguard). A scanned
  // result is checked against the approved name before it is allowed to count.
  //
  // AND IT IS MANDATORY, ON EVERY PATH THROUGH THIS STEP — pre-approved
  // arrivals included (client instruction, 2026-08-17). It was a convenience
  // button: a guard could photograph a face and admit a booked visitor without
  // ever checking that the person holding the pass was the person it was
  // issued to, which is the one thing the gate exists to establish. The walk-in
  // register has demanded a scan since 2026-08-16; a pre-approval is not a
  // weaker claim about identity, it is a claim made EARLIER and by somebody who
  // never saw the visitor. Gated structurally: Check In is disabled without a
  // scan, and `namesMatch` still refuses a scan that names somebody else.
  const scanMissing = scanResult === null;
  const scanSection = (
    <div className="space-y-2">
      {!scanResult ? (
        <>
          <button type="button" onClick={() => setScanOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
            Scan ID card
          </button>
          <p className="text-[11px] text-navy-700">
            Required. The visitor cannot be checked in until their ID card has been scanned.
          </p>
        </>
      ) : (
        // Everything the scan read, kept on screen — the verdict alone asked
        // the guard to trust a match without seeing what had been matched.
        <CheckInScanSummary
          scan={scanResult}
          verdict={matchStatus ?? 'no-name'}
          approvedName={selectedMatch.visitorName}
          onDiscard={() => changeScan(null)}
          onRescan={() => setScanOpen(true)}
          overridden={overridden}
          onOverride={override}
        />
      )}
    </div>
  );


  // The card the visitor must give back at check-out. Required, and format-
  // constrained (migration 076's CHECK + lib/cardNumber.ts mirror each other),
  // so a guard is told what is wrong before the write, not by the write.
  const cardInvalid = cardNumber.trim() !== '' && !isValidCardNumber(cardNumber);
  const cardMissing = cardNumber.trim() === '';
  const cardBad = cardInvalid || cardMissing;
  const cardSection = (
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
        value={cardNumber}
        onChange={(e) => onCardNumberChange(e.target.value)}
        placeholder="e.g. C-104"
        maxLength={20}
        aria-invalid={cardBad}
        aria-describedby="visitor-card-hint"
        className="input w-full"
      />
      {cardBad && (
        <p id="visitor-card-hint" className="text-[11px] text-danger-600 font-semibold">
          {cardMissing ? 'Enter the card number before checking in.' : 'Letters, digits and hyphens only — e.g. C-104.'}
        </p>
      )}
    </div>
  );

  // Why Check In is refused, in one line, rather than a disabled button with no
  // stated reason — the field hints are spread down a long card and the guard
  // is standing in front of somebody. Discarding a scan is still allowed (it is
  // how a misread is corrected) and simply puts the check-in back behind the
  // requirement.
  // A mismatch the guard has overridden is no longer a blocker — the summary
  // card above says so in its own words, and repeating it here as a refusal
  // would contradict the button they just pressed.
  const mismatchBlocking = matchStatus === 'mismatch' && !overridden;
  const blockedReason = scanMissing
    ? "Scan the visitor's ID card before checking in."
    : mismatchBlocking
      ? 'The scanned ID does not match the approved visitor. Rescan, or use "check in anyway".'
      : cardBad
        ? 'Enter a valid visitor card number before checking in.'
        : '';

  if (photoBlob === null) {
    return (
      <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
        {scanOpen && (
          <IdScanOverlay
            onScanned={(r) => { changeScan(r); setScanOpen(false); }}
            onClose={() => setScanOpen(false)}
          />
        )}
        <button onClick={onBack} className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to search
        </button>
        <div className="bg-white dark:bg-white/[0.06] dark:border-white/[0.07] rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
          <CheckInStepTracker scanned={scanResult !== null} photoTaken={false} cardDone={!cardBad} />
          <CheckInVisitorSummary match={selectedMatch} />
          {scanSection}
          {/* The camera below is NOT the ID scan starting again — it is the
              visitor's face, and on a laptop with one webcam it is the same
              physical device the scan just used, so it must say which of the
              two it is. The heading and the line under it are the whole fix
              for "why is it showing me the camera again". */}
          <div>
            <p className="text-sm font-bold text-navy-950">Step 2 — Photo of the visitor</p>
            <p className="text-[11px] text-navy-700 mt-0.5">
              Point the camera at the visitor, not at the ID card. This photo is the record of who actually walked in.
            </p>
          </div>
          {/* ONE camera at a time. PhotoCapture mounts only once the scan
              overlay is closed: while it is open, mounting it underneath
              starts a SECOND getUserMedia stream that fights the scan's rear
              camera (the scan then fails to start on phones) and shows a
              second camera screen through the translucent backdrop — which a
              guard reads as a second OCR page. When the scan closes, the
              overlay unmounts its camera and PhotoCapture mounts fresh. */}
          {!scanOpen && <PhotoCapture onCapture={onCapture} />}
        </div>
        {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
      {scanOpen && (
        <IdScanOverlay
          onScanned={(r) => { changeScan(r); setScanOpen(false); }}
          onClose={() => setScanOpen(false)}
        />
      )}
      <div className="bg-white dark:bg-white/[0.06] dark:border-white/[0.07] rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
        <CheckInStepTracker scanned={scanResult !== null} photoTaken cardDone={!cardBad} />
        <div className="flex items-center gap-3">
          <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl ring-2 ring-success-200" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-navy-900">{selectedMatch.visitorName}</p>
            <p className="text-sm text-navy-500 dark:text-navy-400 truncate">{selectedMatch.departmentName}</p>
            <p className="text-xs text-success-600 font-semibold mt-1">Photo captured</p>
          </div>
          <button onClick={onRetake} className="text-danger-600 hover:text-danger-700 text-sm font-semibold shrink-0">Retake</button>
        </div>
        {scanSection}
        {cardSection}
        {/* The tick box is the record, the textarea only describes it.
            `carrying_material` used to be inferred from "did the guard type
            anything?", which silently made an empty box mean "carrying
            nothing" — indistinguishable from a guard who ticked the box and
            got interrupted before writing the list. The flag is now an
            explicit answer, and the remarks are gated behind it so the field
            only appears once there is something to describe. */}
        <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] p-3.5 space-y-3">
          <label htmlFor="carrying-material" className="flex items-start gap-3 cursor-pointer">
            <input
              id="carrying-material"
              type="checkbox"
              checked={carrying}
              onChange={(e) => onCarryingChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-300 text-brand-600 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-navy-800 dark:text-white">Carrying material</span>
              <span className="block text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">
                Tick if the visitor is bringing anything in that has to be checked back out.
              </span>
            </span>
          </label>

          {carrying && (
            <div className="animate-fade-in">
              <label className="label" htmlFor="carrying-remarks">What are they carrying?</label>
              <textarea
                id="carrying-remarks"
                value={remarks}
                onChange={(e) => onRemarksChange(e.target.value)}
                placeholder="e.g. 1 Dell Latitude laptop, 2 Samsung phones, 1 toolbox"
                rows={3}
                maxLength={500}
                className="input w-full resize-none"
                aria-describedby="carrying-remarks-hint"
              />
              {/* Free text on purpose: a fixed device list would be wrong within
                  a week, and what matters on the way out is that the guard wrote
                  down enough to match the item back to the visitor. */}
              <p id="carrying-remarks-hint" className="text-[10px] text-navy-300 mt-1">
                List each device or item with quantity and brand, so it can be checked back out.
              </p>
            </div>
          )}
        </div>
        {blockedReason && (
          <p className="text-xs font-semibold text-danger-600" role="status">{blockedReason}</p>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-3 text-sm transition-all">Cancel</button>
          <button onClick={onConfirm} disabled={checkingIn || scanMissing || mismatchBlocking || cardBad}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {checkingIn ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
            ) : 'Check In'}
          </button>
        </div>
      </div>
      {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
    </div>
  );
}