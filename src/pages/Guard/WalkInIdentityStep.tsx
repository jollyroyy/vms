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
//
// THE CAMERA IS OFF UNTIL THE GUARD ASKS FOR IT (client report, 2026-08-16: the
// camera stays on after the form is cleared). PhotoCapture starts its stream on
// mount, and a submitted request remounts this step (WalkInRequest bumps
// `identityKey` to clear the previous visitor's frozen frame) — so the webcam
// light came straight back on and stayed lit at an empty form, pointed at
// whoever was next in the queue. `armed` is local state, so a remount puts it
// back to false and the stream is never requested; capturing a photo stops the
// stream and disarms, which is what turns it off automatically once the photo is
// attached. The control mirrors "Scan ID card" directly above it: on this form
// each capture is something the guard starts.
import React, { useState } from 'react';
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
  const [armed, setArmed] = useState(false);
  // ONE CAMERA AT A TIME survives here: the scan overlay always wins, so opening
  // it takes the photo stream down whether or not the guard armed it.
  const live = armed && !scanOpen;

  const attachPhoto = (blob: Blob) => {
    onPhoto(blob);
    // Unmounting PhotoCapture is what releases the device. It has already
    // stopped its own stream at capture, but the record of that lives inside the
    // component — leaving it mounted would restart nothing yet still hold the
    // <video>, and "Retake" is one click away from a live feed nobody asked for.
    setArmed(false);
  };

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

      {live && <PhotoCapture onCapture={attachPhoto} />}
      {live && !photoTaken && (
        <p className="text-[11px] font-semibold text-navy-600">
          Capture the photo and press &ldquo;Use Photo&rdquo; to attach it to the request.
        </p>
      )}

      {!live && photoTaken && (
        <div className="rounded-xl bg-success-50 border border-success-200 dark:border-success-500/25 px-3.5 py-2.5 space-y-1">
          <span className="block text-sm font-bold text-success-700">Photo captured — camera off</span>
          <button type="button" onClick={() => setArmed(true)}
            className="text-[11px] font-bold text-success-700 underline underline-offset-2">
            Take it again
          </button>
        </div>
      )}

      {!live && !photoTaken && (
        <button type="button" onClick={() => setArmed(true)} disabled={scanOpen}
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-white/[0.06] hover:bg-surface-100 border border-surface-200 dark:border-white/[0.07] rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
          Turn on camera
        </button>
      )}
    </div>
  );
}
