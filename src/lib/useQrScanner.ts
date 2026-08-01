// useQrScanner — thin lifecycle wrapper around the `qr-scanner` package for the
// guard console. Loads the package lazily (worker/WASM payload stays out of the
// initial bundle) and never throws, so the guard always has a manual-search
// fallback.
//
// 'unavailable' and 'error' are deliberately separate. This hook used to
// collapse every failure into 'unavailable' ("Camera unavailable"), which is
// how a CSP that blocked qr-scanner's blob: worker went unnoticed on the camera
// path for as long as it did — a broken decoder is indistinguishable from a
// laptop with no webcam. 'unavailable' now means only "there is no camera";
// anything else is 'error' and gets logged.
import { useEffect, useRef, useState } from 'react';
import type QrScannerType from 'qr-scanner';

export type QrScannerState = 'starting' | 'scanning' | 'unavailable' | 'error';

type Options = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onDecode: (raw: string) => void;
  paused?: boolean;
};

export function useQrScanner(opts: Options): { state: QrScannerState } {
  const { videoRef, onDecode, paused = false } = opts;
  const [state, setState] = useState<QrScannerState>('starting');

  const onDecodeRef = useRef(onDecode);
  const scannerRef = useRef<QrScannerType | null>(null);
  const mountedRef = useRef(true);

  // Always call the latest onDecode without rebuilding the scanner instance.
  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const destroy = (scanner: QrScannerType | null) => {
      if (!scanner) return;
      scanner.stop();
      scanner.destroy();
    };

    (async () => {
      let hasCamera = false;
      try {
        const { default: QrScanner } = await import('qr-scanner');

        try {
          hasCamera = await QrScanner.hasCamera();
        } catch {
          hasCamera = false;
        }

        if (!hasCamera) {
          if (mountedRef.current) setState('unavailable');
          return;
        }

        if (cancelled || !videoRef.current) return;

        const scanner = new QrScanner(
          videoRef.current,
          (result) => onDecodeRef.current(result.data),
          { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 }
        );

        if (cancelled) {
          destroy(scanner);
          return;
        }
        scannerRef.current = scanner;

        try {
          await scanner.start();
          if (cancelled) {
            destroy(scanner);
            scannerRef.current = null;
            return;
          }
          if (mountedRef.current) setState('scanning');
        } catch (err) {
          // A camera exists but the stream would not start — permission denied,
          // device busy, or the decode engine failed to come up. Not the same
          // as having no camera, so do not say so.
          console.error('[useQrScanner] scanner failed to start:', err);
          destroy(scanner);
          scannerRef.current = null;
          if (mountedRef.current) setState('error');
        }
      } catch (err) {
        // Reached when the qr-scanner module itself fails to load.
        console.error('[useQrScanner] QR engine unavailable:', err);
        if (mountedRef.current) setState('error');
      }
    })();

    return () => {
      mountedRef.current = false;
      cancelled = true;
      destroy(scannerRef.current);
      scannerRef.current = null;
    };
    // Deliberately excludes onDecode: a fresh closure each render must not
    // tear down and rebuild the scanner (that would restart the camera).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    if (paused) {
      scanner.pause();
    } else {
      scanner.start().catch((err) => {
        console.error('[useQrScanner] scanner failed to resume:', err);
        if (mountedRef.current) setState('error');
      });
    }
  }, [paused]);

  return { state };
}
