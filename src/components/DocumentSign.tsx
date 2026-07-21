import React, { useRef, useState, useCallback } from 'react';

interface Props {
  documentTitle: string;
  documentText: string;
  onSign: (signatureDataUrl: string) => void;
  onSkip?: () => void;
  required?: boolean;
}

export default function DocumentSign({ documentTitle, documentText, onSign, onSkip, required }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signed, setSigned] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1e293b';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasDrawn) return;
    onSign(canvas.toDataURL('image/png'));
    setSigned(true);
  };

  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-bold text-navy-900 text-lg">{documentTitle}</h3>
      <div className="bg-surface-50 rounded-xl p-4 text-sm text-navy-700 max-h-40 overflow-y-auto leading-relaxed">
        {documentText}
      </div>
      {!signed ? (
        <>
          <p className="text-xs text-navy-500 font-medium">Signature:</p>
          <div className="border-2 border-dashed border-navy-300 rounded-xl overflow-hidden bg-white touch-none">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={clear} className="btn-secondary text-sm px-4 py-2" disabled={!hasDrawn}>
              Clear
            </button>
            <button onClick={handleSign} className="btn-primary text-sm px-6 py-2" disabled={!hasDrawn}>
              Sign & Accept
            </button>
            {!required && onSkip && (
              <button onClick={onSkip} className="btn-ghost text-sm px-4 py-2 text-navy-400 ml-auto">
                Skip
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 bg-success-50 rounded-xl p-4">
          <svg className="w-6 h-6 text-success-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-success-700">
            Document signed on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
