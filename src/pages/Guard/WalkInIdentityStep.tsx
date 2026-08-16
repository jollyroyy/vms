// The identity half of the walk-in registration form (client instruction,
// 2026-08-16): the ID scan and the visitor's photo are BOTH mandatory before a
// walk-in request can be sent to the person to meet.
//
// This reverses the older split, where the register inserted photo_path /
// photo_data as null and the photo was taken later, at the gate, by
// GuardWalkInApproved. That was defensible while the approval was a coin toss —
// why photograph someone who may be turned away — but it left the HOD deciding
// on a name typed by the guard, with nothing tying the request to the person
// actually standing at reception. The approver now sees a face and a document
// type that were captured before the request existed. GuardWalkInApproved still
// captures its own photo at the moment of entry; that one records who walked
// through the gate, this one records who asked.
//
// ONE CAMERA AT A TIME: PhotoCapture is unmounted while the scan overlay is
// open. Two live streams (the scan's rear camera and the photo's front camera)
// make the scan fail to start on phones, and the second feed shows through the
// translucent backdrop as what looks like a second scan page.
import React from 'react';
import PhotoCapture from '../../components/PhotoCapture';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';

type Props = {
  scan: IdScanResult | null;
  scanOpen: boolean;
  onOpenScan: () => void;
  onCloseScan: () => void;
  onScanned: (result: IdScanResult) => void;
  onDiscardScan: () => void;
  photoTaken: boolean;
  onPhoto: (blob: Blob) => void;
};

export default function WalkInIdentityStep({
  scan, scanOpen, onOpenScan, onCloseScan, onScanned, onDiscardScan, photoTaken, onPhoto,
}: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] bg-surface-50 dark:bg-white/[0.03] p-3.5 space-y-3">
      <div>
        <p className="text-sm font-bold text-navy-900">Identity *</p>
        <p className="text-[11px] text-navy-600 mt-0.5">
          Scan the visitor&rsquo;s ID card and take their photo. Both are required before the
          request can be sent for approval.
        </p>
      </div>

      {scanOpen && <IdScanOverlay onScanned={onScanned} onClose={onCloseScan} />}

      {/* Step 1 — the document. */}
      {scan ? (
        <div className="rounded-xl bg-success-50 border border-success-200 dark:border-success-500/25 px-3.5 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-success-700">ID scanned</span>
            <span className="text-xs text-success-700/80 tabular-nums">
              {scan.idType || 'ID'} •••• {scan.idLast4 || '––'}
            </span>
          </div>
          <button type="button" onClick={onDiscardScan}
            className="text-[11px] font-bold text-success-700 underline underline-offset-2">
            Scan again
          </button>
        </div>
      ) : (
        <button type="button" onClick={onOpenScan}
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-white/[0.06] hover:bg-surface-100 border border-surface-200 dark:border-white/[0.07] rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
          Scan ID card
        </button>
      )}

      {/* Step 2 — the face. Deliberately below the scan: the scan fills in the
          name, and the guard is looking at the document at that moment anyway. */}
      <div>
        <p className="text-sm font-bold text-navy-950">Photo of the visitor</p>
        <p className="text-[11px] text-navy-700 mt-0.5">
          Point the camera at the visitor, not at the ID card.
        </p>
      </div>
      {!scanOpen && <PhotoCapture onCapture={onPhoto} />}
      {!photoTaken && !scanOpen && (
        <p className="text-[11px] font-semibold text-navy-600">
          Capture the photo and press &ldquo;Use Photo&rdquo; to attach it to the request.
        </p>
      )}
    </div>
  );
}
