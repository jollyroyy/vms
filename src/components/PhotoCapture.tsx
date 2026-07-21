/**
 * PhotoCapture — FR-CAM-04/05/06/07/08/10
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { computeCenterCrop, PHOTO_CONSTRAINTS, stripExifViaCanvas } from '../lib/photo';

type Props = { onCapture: (blob: Blob) => void };
type State = 'idle' | 'streaming' | 'frozen' | 'denied' | 'error';

export default function PhotoCapture({ onCapture }: Props): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [state, setState] = useState<State>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setState('idle'); setErrMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      // Bail if component unmounted while awaiting permission
      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }

      video.srcObject = stream;

      // Wait for loadedmetadata before calling play() to avoid interruption
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Video element error'));
        // Timeout fallback
        setTimeout(() => resolve(), 3000);
      });

      // Guard: check video is still in DOM and component is still mounted
      if (!mountedRef.current || !videoRef.current || !document.contains(video)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      try {
        await video.play();
      } catch (playErr) {
        // "play() interrupted" is non-fatal — the video may still play after re-render
        const msg = playErr instanceof Error ? playErr.message : '';
        if (msg.includes('interrupted') || msg.includes('removed from the document')) {
          console.warn('[PhotoCapture] play() interrupted, retrying...');
          // Small delay then retry once
          await new Promise((r) => setTimeout(r, 100));
          if (mountedRef.current && videoRef.current && document.contains(videoRef.current)) {
            videoRef.current.srcObject = stream;
            try { await videoRef.current.play(); } catch { /* give up silently */ }
          }
        } else {
          throw playErr;
        }
      }

      if (mountedRef.current) setState('streaming');
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) setState('denied');
      else { setErrMsg(msg); setState('error'); }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [startCamera, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const { videoWidth: vw, videoHeight: vh } = video;
    if (vw === 0 || vh === 0) return; // not ready yet
    const crop = computeCenterCrop(vw, vh);
    canvas.width = PHOTO_CONSTRAINTS.width; canvas.height = PHOTO_CONSTRAINTS.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setPreview(URL.createObjectURL(blob)); setFileBlob(blob); setState('frozen');
      stopStream();
    }, 'image/webp', 0.8);
  }, [stopStream]);

  const retake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setFileBlob(null);
    startCamera();
  }, [preview, startCamera]);

  const accept = useCallback(() => { if (fileBlob) onCapture(fileBlob); }, [fileBlob, onCapture]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    try {
      const strippedBlob = await stripExifViaCanvas(file);
      setPreview(URL.createObjectURL(strippedBlob));
      setFileBlob(strippedBlob);
      setState('frozen');
      stopStream();
    } catch {
      // Fallback: use raw blob if canvas fails (e.g., in test environments)
      const blob = new Blob([file], { type: file.type });
      setPreview(URL.createObjectURL(blob));
      setFileBlob(blob);
      setState('frozen');
      stopStream();
    }
  }, [stopStream]);

  if (state === 'denied' || state === 'error') {
    return (
      <div className="rounded-xl border border-danger-500/20 bg-danger-50 p-5 space-y-3">
        <p className="font-semibold text-danger-700 text-sm">
          {state === 'denied' ? 'Camera access denied — allow permission and refresh' : `Camera error: ${errMsg}`}
        </p>
        <p className="text-sm text-danger-600">Use file picker instead:</p>
        <input type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="text-sm w-full" />
        {preview && (
          <div className="mt-3 space-y-3">
            <img src={preview} alt="Captured" className="w-full max-w-xs rounded-xl border mx-auto" />
            <button onClick={accept} className="btn-accent text-sm w-full">Use this photo</button>
          </div>
        )}
      </div>
    );
  }

  if (state === 'frozen' && preview) {
    return (
      <div className="space-y-3">
        <img src={preview} alt="Captured" className="w-full max-w-xs rounded-xl border-2 border-brand-500 mx-auto block shadow-soft" />
        <div className="flex gap-3 justify-center">
          <button onClick={retake} className="btn-secondary text-sm px-5 py-2.5">Retake</button>
          <button onClick={accept} className="btn-accent text-sm px-5 py-2.5">Use Photo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative w-full max-w-xs mx-auto">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full rounded-xl bg-navy-950 ring-2 ring-surface-200"
          style={{ aspectRatio: '3/4', objectFit: 'cover' }}
        />
        {/* Face guide oval */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="border-[3px] border-white/50 rounded-full w-3/4 h-3/4" />
        </div>
        {state === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70 rounded-xl">
            <div className="text-center text-white text-sm">
              <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
              Starting camera...
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {state === 'streaming' && (
        <div className="flex flex-col items-center gap-2">
          <button onClick={capture} className="rounded-full bg-danger-600 hover:bg-danger-700 text-white px-8 py-2.5 text-sm font-semibold shadow-soft transition-all active:scale-95">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-white animate-pulse-soft" />
              Capture Photo
            </span>
          </button>
          <label className="text-xs text-navy-400 cursor-pointer hover:text-brand-600 transition-colors">
            <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
            Or upload from device
          </label>
        </div>
      )}
    </div>
  );
}
