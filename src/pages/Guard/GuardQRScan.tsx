// GuardQRScan — camera-first check-in entry point. Scans a visitor's QR code
// and resolves it to a visit via lookupVisitByQr. Manual search is always one
// tap away: if the camera is unavailable, a lookup fails, or the guard simply
// prefers it, `onCancel` hands control back to the phone-number search flow.
// A photo of a pass held up to the live camera often fails to focus/decode
// (glare, distance), so "Upload Pass Image or PDF" runs the same payload
// through a still-file decode instead of the live video stream. Visitors are
// handed a PDF pass (see lib/qrPassPdf.ts), so the upload path must accept
// that PDF directly rather than making the guard screenshot it first —
// decodeQrFile handles both images and PDFs behind one call.
import React, { useCallback, useRef, useState } from 'react';
import { decodeQrFile } from '../../lib/decodeQrImage';
import { lookupVisitByQr } from '../../lib/qrLookup';
import { useQrScanner } from '../../lib/useQrScanner';
import type { Visit } from '../../types/index';

type Props = {
  /** A pass that PASSED its gate and may proceed straight to check-in. */
  onResolved: (visit: Visit) => void;
  /** A pass that RESOLVED to a real visit but may not proceed — already
   *  checked in, already completed, expired, refused, a no-show.
   *
   *  Optional, and the fallback matters: without a handler this component
   *  keeps its own inline red banner, which is all `CheckInScanGate` (a modal
   *  with no room for a record) wants. `ScanPass` supplies one so it can show
   *  the visitor's full record instead of a one-line refusal — client
   *  instruction, 2026-08-17: as soon as a pass is scanned the guard should
   *  see the name, the number, the company, the reason, the times, the type
   *  of visitor, the host, the department and the status. A blocked scan is
   *  the case where they need all of that MOST: "already checked in" is the
   *  start of a question, not the answer to one.
   *
   *  The gate decision itself does not move — `evaluateQrVisit` still decides,
   *  and this callback is never reached for a pass that may proceed. What
   *  changes is only how the refusal is presented. */
  onBlocked?: (visit: Visit, reason: string) => void;
  onCancel: () => void;
  /**
   * Open the camera on mount. Default true.
   *
   * `CheckInScanGate` leaves it true and must: it is a modal a guard opened by
   * pressing Scan, so the press has already happened and asking for a second
   * one would be a button behind a button.
   *
   * `ScanPass` passes false (client instruction, 2026-08-17). That page is a
   * whole TAB, and it is also the search desk — the guard who lands on it to
   * look someone up by mobile number is the common case, not the exception,
   * and they were getting the webcam light and a live picture of themselves
   * for their trouble. Nothing here reads the camera until the guard says
   * "Scan QR code", and `useQrScanner`'s `enabled` makes that structural: no
   * device is acquired, rather than acquired and then paused.
   */
  autoStart?: boolean;
};

type ScanMessage = {
  kind: 'blocked' | 'invalid' | 'not_found' | 'error';
  text: string;
  visitorName?: string;
};

// Direct lookup for the two statuses with fixed copy — 'found' branches on
// gate.ok and 'error' carries a server-supplied message, so those are handled
// separately in handleDecode rather than folded into this map.
const STATUS_TEXT: Record<'invalid' | 'not_found', string> = {
  invalid: "This is not a visitor pass QR code.",
  not_found: 'No visit matches this QR code.',
};

// Split by fault: `no_code` is something the guard can act on, `engine` is ours.
const UPLOAD_FAIL_TEXT: Record<'no_code' | 'engine', string> = {
  no_code: 'No QR code found in that file. Try a clearer photo, upload the full pass page, or search manually.',
  // Covers both a dead QR decoder and a PDF that would not render. Either way
  // the fault is ours, not the file's, so it must never read as "bad photo".
  engine: 'We could not read that file on this device — this is a fault in the app, not the pass. Search manually and report it; a clearer photo will not help.',
};

export default function GuardQRScan({ onResolved, onBlocked, onCancel, autoStart = true }: Props): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [message, setMessage] = useState<ScanMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  // Has the guard asked for the camera? Seeded from `autoStart`, and one-way:
  // once armed it stays armed for the life of the component, so a refused code
  // does not send them back to the button.
  const [armed, setArmed] = useState(autoStart);

  const handleDecode = useCallback((raw: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    lookupVisitByQr(raw).then((result) => {
      inFlightRef.current = false;

      switch (result.status) {
        case 'found': {
          if (result.gate.ok) {
            onResolved(result.visit);
            break;
          }
          const reason = result.gate.reason ?? 'This visit cannot proceed.';
          // Hand the whole visit up when the parent can render it; fall back to
          // the inline banner when it cannot. The scanner is left PAUSED either
          // way (`paused: message !== null` below only covers the fallback), so
          // the parent that takes the visit is responsible for unmounting or
          // resetting this component — ScanPass swaps it out for the record.
          if (onBlocked) onBlocked(result.visit, reason);
          else setMessage({ kind: 'blocked', text: reason, visitorName: result.visit.visitor?.full_name });
          break;
        }
        case 'invalid':
        case 'not_found':
          setMessage({ kind: result.status, text: STATUS_TEXT[result.status] });
          break;
        case 'error':
          setMessage({ kind: 'error', text: result.message });
          break;
      }
    }).catch(() => {
      // lookupVisitByQr resolves its own failures, so this is belt-and-braces:
      // an unexpected rejection must still clear the in-flight latch, or the
      // scanner would silently ignore every subsequent code.
      inFlightRef.current = false;
      setMessage({ kind: 'error', text: 'Could not read that code. Try again or search manually.' });
    });
  }, [onResolved, onBlocked]);

  const { state } = useQrScanner({ videoRef, onDecode: handleDecode, paused: message !== null, enabled: armed });

  const retry = useCallback(() => setMessage(null), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || inFlightRef.current) return;

    setUploading(true);
    decodeQrFile(file).then((decoded) => {
      setUploading(false);
      if (decoded.ok) {
        handleDecode(decoded.payload);
      } else {
        // Two very different failures. Blaming the visitor's image for a broken
        // decoder sends the guard chasing a better photo that will never work.
        setMessage({ kind: decoded.reason === 'engine' ? 'error' : 'invalid', text: UPLOAD_FAIL_TEXT[decoded.reason] });
      }
    });
  }, [handleDecode]);

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Scan QR</h2>
          <p className="text-sm text-navy-500 dark:text-navy-400">
            {armed
              ? "Hold the visitor's QR code up to the camera, or upload the pass as an image or a PDF."
              : 'The camera stays off until you start a scan. You can also upload the pass as an image or a PDF, or search for the visitor.'}
          </p>
        </div>

        {!armed ? (
          // The camera is not open yet and nothing on this branch touches it.
          // A dark placeholder the same shape as the video frame, so arming it
          // swaps a picture for a picture rather than reflowing the page under
          // the guard's hand.
          <div className="space-y-4">
            <div
              className="w-full max-w-xs mx-auto rounded-xl bg-navy-950 ring-2 ring-surface-200 flex flex-col items-center justify-center gap-2 text-center px-6"
              style={{ aspectRatio: '3/4' }}>
              <svg className="w-10 h-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm9.75 0c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm-9.75 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75 0h2.25v2.25H13.5v-2.25zm4.5 0h2.25v2.25H18v-2.25zm-4.5 4.5h2.25v2.25H13.5V19.125zm4.5 0h2.25v2.25H18V19.125z" />
              </svg>
            </div>
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold w-full max-w-xs mx-auto block px-5 py-2.5 rounded-xl text-sm transition-all">
              Scan QR code
            </button>
          </div>
        ) : state === 'unavailable' || state === 'error' ? (
          <p className="text-sm font-semibold text-navy-600">
            {state === 'error'
              ? 'The QR scanner failed to start on this device. Upload the pass file below, or search for the visitor instead.'
              : 'Camera unavailable on this device. Upload the pass file below, or search for the visitor instead.'}
          </p>
        ) : (
          <div className="relative w-full max-w-xs mx-auto">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full rounded-xl bg-navy-950 ring-2 ring-surface-200"
              style={{ aspectRatio: '3/4', objectFit: 'cover' }}
            />
            {state === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70 rounded-xl">
                <div className="text-center text-white text-sm">
                  <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                  Starting camera...
                </div>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold space-y-1">
            <p>{message.text}</p>
            {message.visitorName && <p>Visitor: {message.visitorName}</p>}
          </div>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          {message && (
            <button onClick={retry} className="btn-secondary text-sm px-5 py-2.5">
              Scan Again
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={
              // Camera down/broken: uploading the pass file is the only way
              // forward on this device, so it gets primary emphasis instead
              // of sitting as a quiet secondary option below a dead camera.
              state === 'unavailable' || state === 'error'
                ? 'bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60'
                : 'btn-secondary text-sm px-5 py-2.5 disabled:opacity-60'
            }
          >
            {uploading ? 'Reading Pass...' : 'Upload Pass Image or PDF'}
          </button>
          <button onClick={onCancel} className="btn-secondary text-sm px-5 py-2.5">
            Search Manually
          </button>
        </div>
      </div>
    </div>
  );
}
