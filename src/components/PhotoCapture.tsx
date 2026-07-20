/**
 * PhotoCapture — FR-CAM-04/05/06/07/08/10
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { computeCenterCrop, PHOTO_CONSTRAINTS } from '../lib/photo';

type Props = { onCapture: (blob: Blob) => void };
type State = 'idle' | 'streaming' | 'frozen' | 'denied' | 'error';

export default function PhotoCapture({ onCapture }: Props): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);

  const startCamera = useCallback(async () => {
    setState('idle'); setErrMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setState('streaming');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) setState('denied');
      else { setErrMsg(msg); setState('error'); }
    }
  }, []);

  useEffect(() => { startCamera(); return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }; }, [startCamera]);

  const capture = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const { videoWidth: vw, videoHeight: vh } = video;
    const crop = computeCenterCrop(vw, vh);
    canvas.width = PHOTO_CONSTRAINTS.width; canvas.height = PHOTO_CONSTRAINTS.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setPreview(URL.createObjectURL(blob)); setFileBlob(blob); setState('frozen');
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }, 'image/webp', 0.8);
  }, []);

  const retake = useCallback(() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setFileBlob(null); startCamera(); }, [preview, startCamera]);
  const accept = useCallback(() => { if (fileBlob) onCapture(fileBlob); }, [fileBlob, onCapture]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blob = new Blob([file], { type: file.type });
    setPreview(URL.createObjectURL(blob)); setFileBlob(blob); setState('frozen');
  }, []);

  if (state === 'denied' || state === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
        <p className="font-semibold text-red-700 text-sm">
          {state === 'denied' ? 'Camera access denied — allow permission and refresh' : `Camera error: ${errMsg}`}
        </p>
        <p className="text-sm text-red-600">Use the file picker as a fallback:</p>
        <input type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="text-sm w-full" />
        {preview && (
          <div className="mt-2 space-y-2">
            <img src={preview} alt="Captured" className="w-full max-w-xs rounded-xl border mx-auto" />
            <button onClick={accept} className="btn-primary text-sm w-full">Use this photo</button>
          </div>
        )}
      </div>
    );
  }

  if (state === 'frozen' && preview) {
    return (
      <div className="space-y-3">
        <img src={preview} alt="Captured" className="w-full max-w-xs rounded-xl border-2 border-brand-500 mx-auto block shadow-md" />
        <div className="flex gap-2 justify-center">
          <button onClick={retake} className="btn-secondary text-sm px-5 py-2">Retake</button>
          <button onClick={accept} className="btn-accent text-sm px-5 py-2">Use Photo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative w-full max-w-xs mx-auto">
        <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl bg-navy-950 ring-2 ring-brand-200" style={{ aspectRatio: '3/4', objectFit: 'cover' }} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="border-[3px] border-white/60 rounded-full w-3/4 h-3/4" />
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
        <div className="flex justify-center">
          <button onClick={capture} className="rounded-full bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 text-sm font-semibold shadow-md transition-all active:scale-95">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white animate-pulse" />Capture Photo</span>
          </button>
        </div>
      )}
    </div>
  );
}
