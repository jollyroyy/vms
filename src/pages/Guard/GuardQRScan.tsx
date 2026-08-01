// GuardQRScan — camera-first check-in entry point. Scans a visitor's QR code
// and resolves it to a visit via lookupVisitByQr. Manual search is always one
// tap away: if the camera is unavailable, a lookup fails, or the guard simply
// prefers it, `onCancel` hands control back to the phone-number search flow.
// A photo of a pass held up to the live camera often fails to focus/decode
// (glare, distance), so "Upload QR Image" runs the same payload through a
// still-image decode instead of the live video stream.
import React, { useCallback, useRef, useState } from 'react';
import { decodeQrImage } from '../../lib/decodeQrImage';
import { lookupVisitByQr } from '../../lib/qrLookup';
import { useQrScanner } from '../../lib/useQrScanner';
import type { Visit } from '../../types/index';

type Props = {
  onResolved: (visit: Visit) => void;
  onCancel: () => void;
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
  no_code: 'No QR code found in that image. Ask for the pass image (not the PDF), try a clearer photo, or search manually.',
  engine: 'The QR reader failed to start on this device. Search manually and report this — a clearer photo will not help.',
};

export default function GuardQRScan({ onResolved, onCancel }: Props): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [message, setMessage] = useState<ScanMessage | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleDecode = useCallback((raw: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    lookupVisitByQr(raw).then((result) => {
      inFlightRef.current = false;

      switch (result.status) {
        case 'found':
          if (result.gate.ok) {
            onResolved(result.visit);
          } else {
            setMessage({
              kind: 'blocked',
              text: result.gate.reason ?? 'This visit cannot proceed.',
              visitorName: result.visit.visitor?.full_name,
            });
          }
          break;
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
  }, [onResolved]);

  const { state } = useQrScanner({ videoRef, onDecode: handleDecode, paused: message !== null });

  const retry = useCallback(() => setMessage(null), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || inFlightRef.current) return;

    setUploading(true);
    decodeQrImage(file).then((decoded) => {
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
          <p className="text-sm text-navy-400">
            Hold the visitor's QR code up to the camera, or upload an image of it
            (PNG or JPG — a PDF pass must be screenshotted first).
          </p>
        </div>

        {state === 'unavailable' || state === 'error' ? (
          <p className="text-sm font-semibold text-navy-600">
            {state === 'error'
              ? 'The QR scanner failed to start on this device. Upload an image of the pass, or search for the visitor instead.'
              : 'Camera unavailable — search for the visitor instead.'}
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
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-sm px-5 py-2.5 disabled:opacity-60"
          >
            {uploading ? 'Reading Image...' : 'Upload QR Image'}
          </button>
          <button onClick={onCancel} className="btn-secondary text-sm px-5 py-2.5">
            Search Manually
          </button>
        </div>
      </div>
    </div>
  );
}
