// One camera service. Every screen that needs a live webcam feed — visitor
// photo, ID document scan, face verification — goes through this hook.
//
// Extracted verbatim from PhotoCapture.tsx, which used to own the only
// getUserMedia() call in the app. The rule this enforces: do NOT write a second
// getUserMedia() anywhere. Four half-correct webcam implementations, each with
// its own subtly-different teardown, is how a camera ends up staying on after a
// screen closes — the light stays lit and visitors notice.
//
// The awkward parts below are all load-bearing; see the comments at each.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type CameraStatus = 'idle' | 'streaming' | 'denied' | 'error';

export type CameraStreamOptions = {
  /** 'user' = selfie camera (faces). 'environment' = rear camera (ID cards). */
  facingMode?: 'user' | 'environment';
  /** Start automatically on mount. Default true. */
  autoStart?: boolean;
};

export type CameraStream = {
  status: CameraStatus;
  /** Only meaningful when status === 'error'. */
  errorMessage: string;
  start: () => Promise<void>;
  stop: () => void;
};

const METADATA_TIMEOUT_MS = 3000;
const PLAY_RETRY_DELAY_MS = 100;

/** True for the "user denied camera permission" family of errors, which the UI
 *  must present differently from a hardware fault: one is fixed by the visitor
 *  clicking Allow, the other is not fixable from inside the page. */
function isPermissionError(message: string): boolean {
  return message.includes('Permission') || message.includes('NotAllowed');
}

/** play() rejections that are recoverable by simply trying again — React can
 *  re-render and detach the <video> mid-play, which is not a real failure. */
function isInterruptedPlayError(message: string): boolean {
  return message.includes('interrupted') || message.includes('removed from the document');
}

export function useCameraStream(
  videoRef: RefObject<HTMLVideoElement>,
  options: CameraStreamOptions = {},
): CameraStream {
  const { facingMode = 'user', autoStart = true } = options;

  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setStatus('idle');
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      // Bail if the component unmounted while the permission prompt was open.
      // Without this the track stays live with nothing left to render it.
      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }

      video.srcObject = stream;

      // Wait for loadedmetadata before play(), otherwise play() races the
      // stream attaching and rejects. The timeout is a fallback for browsers
      // that never fire the event on an already-ready element.
      //
      // Whichever of the three outcomes lands first must cancel the other two.
      // The original version left the 3s timer running forever: harmless in a
      // real browser, where it only re-resolves a settled promise, but it kept
      // firing into torn-down components and made the camera's teardown depend
      // on timing. With three consumers instead of one, that becomes the kind
      // of intermittent failure nobody can reproduce.
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          if (timer !== undefined) clearTimeout(timer);
          video.onloadedmetadata = null;
          video.onerror = null;
          fn();
        };
        video.onloadedmetadata = () => settle(resolve);
        video.onerror = () => settle(() => reject(new Error('Video element error')));
        timer = setTimeout(() => settle(resolve), METADATA_TIMEOUT_MS);
      });

      // Re-check: the await above is a suspension point, and the element may
      // have left the DOM during it.
      if (!mountedRef.current || !videoRef.current || !document.contains(video)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      try {
        await video.play();
      } catch (playErr) {
        const msg = playErr instanceof Error ? playErr.message : '';
        if (isInterruptedPlayError(msg)) {
          console.warn('[useCameraStream] play() interrupted, retrying...');
          await new Promise((r) => setTimeout(r, PLAY_RETRY_DELAY_MS));
          if (mountedRef.current && videoRef.current && document.contains(videoRef.current)) {
            videoRef.current.srcObject = stream;
            try { await videoRef.current.play(); } catch { /* give up silently */ }
          }
        } else {
          throw playErr;
        }
      }

      if (mountedRef.current) setStatus('streaming');
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (isPermissionError(msg)) setStatus('denied');
      else { setErrorMessage(msg); setStatus('error'); }
    }
  }, [facingMode, videoRef]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) start();
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [autoStart, start, stop]);

  return { status, errorMessage, start, stop };
}
