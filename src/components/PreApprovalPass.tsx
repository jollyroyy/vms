// On-screen entry-pass preview for a pre-approved visit, with a Download PDF
// action. Lives in components/ (not pages/HOD/) because it is shown from two
// places: PreApproveForm's success popup right after pre-approving, and
// VisitorDetails' "View Pass" toggle for reopening an already-approved visit.
// Deliberately NOT components/Badge: that component is print-only (base.css
// `.print-only { display: none }` outside @media print) and built for the
// physical gate pass, so reusing it here would render invisibly on screen.
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Visit } from '../types/index';
import { buildQrPayload } from '../lib/qrToken';
import { downloadQrPassPdf } from '../lib/qrPassPdf';
import { downloadQrPassPng } from '../lib/qrPassImage';

type Props = { visit: Visit };

export default function PreApprovalPass({ visit }: Props): React.ReactElement {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setQrDataUrl(null);
    // margin left at the qrcode library's spec default (4 modules) — a
    // tighter quiet zone breaks detection once the code has been printed,
    // screenshotted, or photographed instead of scanned straight off-screen.
    QRCode.toDataURL(buildQrPayload(visit.qr_token), {
      width: 240,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [visit.qr_token]);

  return (
    <div className="border-t border-surface-200 pt-4 mt-2 flex flex-col items-center gap-2">
      <p className="text-xs font-bold text-navy-400 uppercase tracking-wide">Entry Pass</p>
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="Entry pass QR code" className="w-32 h-32 rounded-lg ring-1 ring-surface-200" />
      ) : (
        <div className="w-32 h-32 rounded-lg bg-surface-50 animate-pulse" />
      )}
      <p className="text-[11px] text-navy-400 font-mono">{visit.ref_number}</p>
      <p className="text-[10px] text-navy-300">Scan this at the guard console to check in</p>
      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => qrDataUrl && downloadQrPassPng(visit, qrDataUrl)}
          disabled={!qrDataUrl}
          className="btn-secondary text-xs px-4 py-2 disabled:opacity-60"
        >
          Download Image
        </button>
        <button
          type="button"
          onClick={() => qrDataUrl && downloadQrPassPdf(visit, qrDataUrl)}
          disabled={!qrDataUrl}
          className="btn-secondary text-xs px-4 py-2 disabled:opacity-60"
        >
          Download PDF
        </button>
      </div>
      <p className="text-[10px] text-navy-300 text-center">
        Send the image if the guard will upload it — the PDF is for printing.
      </p>
    </div>
  );
}
