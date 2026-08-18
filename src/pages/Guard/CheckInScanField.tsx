// The mandatory ID-scan control on the check-in step: either the button that
// opens the scanner, or everything the scan read once it has.
//
// Split out of CheckInPhotoStep (2026-08-18) under the 300-line cap, alongside
// CheckInCardField. It renders only — whether a scan is MISSING, and what that
// means for the Check In button, stays in the step beside the other blockers,
// so one place decides whether the visitor may be admitted.
import React from 'react';
import CheckInScanSummary from './CheckInScanSummary';
import type { IdScanResult } from './IdScanOverlay';

type Props = {
  scanResult: IdScanResult | null;
  verdict: 'match' | 'mismatch' | 'no-name';
  approvedName: string;
  overridden: boolean;
  onOpen: () => void;
  onDiscard: () => void;
  onOverride: () => void;
};

export default function CheckInScanField({
  scanResult, verdict, approvedName, overridden, onOpen, onDiscard, onOverride,
}: Props): React.ReactElement {
  return (
    <div className="space-y-2">
      {!scanResult ? (
        <>
          <button type="button" onClick={onOpen}
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
          verdict={verdict}
          approvedName={approvedName}
          onDiscard={onDiscard}
          onRescan={onOpen}
          overridden={overridden}
          onOverride={onOverride}
        />
      )}
    </div>
  );
}
