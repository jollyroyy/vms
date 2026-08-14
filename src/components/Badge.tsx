/**
 * Badge — FR-VIS-05
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Visit } from '../types/index';
import { buildQrPayload } from '../lib/qrToken';
import { maskIdProof } from '../lib/pii';

type Props = { visit: Visit };

function formatPurpose(purpose: string): string {
  if (!purpose) return '—';
  return purpose.charAt(0).toUpperCase() + purpose.slice(1);
}

export default function Badge({ visit }: Props): React.ReactElement {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const visitor = visit.visitor;
  const dept = visit.department;
  const host = visit.host;

  useEffect(() => {
    const payload = visit?.qr_token
      ? buildQrPayload(visit.qr_token)
      : `vms://visit/${visit?.ref_number}`;

    if (visit?.qr_token || visit?.ref_number) {
      // margin left at the qrcode library's spec default (4 modules) — a
      // printed badge needs the full quiet zone for a guard's scanner to
      // lock onto the finder patterns reliably.
      QRCode.toDataURL(payload, { width: 192, color: { dark: '#1e293b', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
  }, [visit?.qr_token, visit?.ref_number]);

  return (
    <div className="print-only mx-auto w-72 rounded-2xl bg-white overflow-hidden" style={{ border: '2px solid transparent', backgroundClip: 'padding-box', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12), 0 0 0 2px #1e293b' }}>
      {/* White header with the Quest Mall issuing-company logo */}
      <div className="bg-white px-5 pt-4 pb-2 flex flex-col items-center">
        {/* Dark lanyard notch */}
        <div className="w-16 h-3.5 rounded-full bg-[#111827] mb-3" aria-hidden="true" />
        <img
          src="/quest-mall-logo.jpg"
          alt="Quest Mall"
          width={193}
          height={160}
          className="h-14 w-16 object-contain"
          draggable={false}
        />
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a6070]">Quest Mall · Issued Pass</p>
      </div>

      {/* Bold blue band, exactly as the reference screen */}
      <div className="bg-[#1d4ed8] px-5 py-2.5 text-center">
        <p className="text-[14px] font-bold text-white uppercase tracking-[0.14em]">Visitor Pass</p>
        <p className="text-[10px] text-white/75 mt-0.5 font-mono tracking-wider">{visit.ref_number}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Photo with rounded corners and shadow ring */}
        {visit.photo_url ? (
          <div className="mx-auto w-28 h-36 rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 16px -4px rgba(0,0,0,0.15), 0 0 0 3px rgba(51,150,255,0.1)' }}>
            <img src={visit.photo_url} alt="Visitor" className="w-full h-full object-cover block" />
          </div>
        ) : (
          <div className="w-28 h-36 bg-gradient-to-br from-surface-50 to-surface-200 rounded-2xl mx-auto flex items-center justify-center" style={{ boxShadow: '0 0 0 3px rgba(51,150,255,0.08)' }}>
            <svg className="w-10 h-10 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
          </div>
        )}

        {/* Typography hierarchy */}
        <div className="text-center space-y-1">
          <p className="font-extrabold text-navy-950 text-xl tracking-tight">{visitor?.full_name ?? '—'}</p>
          <p className="text-sm text-navy-500 dark:text-navy-400 font-medium">{visitor?.vendor_name ?? ''}</p>
        </div>

        {/* Info rows with clean separators */}
        <div className="text-xs text-navy-600 space-y-0 border-t border-surface-200 pt-3">
          {/* Department used to have its own row directly above this one —
              folded under Person to Meet instead, so the printed pass never
              shows the same department value twice. */}
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-500 dark:text-navy-400 font-medium">Person to Meet</span>
            <span className="text-right">
              <span className="block font-semibold text-navy-700">{host?.full_name ?? '—'}</span>
              {host?.full_name && dept?.name && (
                <span className="block text-[10px] text-navy-500 dark:text-navy-400">{dept.name}</span>
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-500 dark:text-navy-400 font-medium">Purpose</span>
            <span className="font-semibold text-navy-700">{formatPurpose(visit.purpose)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-500 dark:text-navy-400 font-medium">ID Proof</span>
            <span className="font-semibold text-navy-700 font-mono">{maskIdProof(visitor?.id_type, visitor?.id_last4)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-500 dark:text-navy-400 font-medium">Date</span>
            <span className="font-semibold text-navy-700">{new Date(visit.created_at).toLocaleDateString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-navy-500 dark:text-navy-400 font-medium">Status</span>
            <span className="capitalize font-bold text-brand-700">{visit.status.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* QR code with clean presentation */}
        <div className="flex flex-col items-center gap-2 pt-1">
          {qrDataUrl ? (
            <div className="p-2 bg-white rounded-xl" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
              <img src={qrDataUrl} alt="QR Code" className="w-16 h-16" />
            </div>
          ) : (
            <div className="w-16 h-16 border-2 border-navy-800 rounded-xl flex items-center justify-center text-xs text-navy-500 dark:text-navy-400 bg-surface-50 animate-pulse">QR</div>
          )}
          <p className="text-[10px] text-navy-300 font-medium">Scan at reception</p>
        </div>
      </div>

      {/* Premium footer with hologram-style effect */}
      <div className="px-5 py-3 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f4f4f5, #eef8ff, #f4f4f5)', borderTop: '1px solid rgba(228,228,231,0.6)' }}>
        <div className="absolute inset-0 opacity-20" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(51,150,255,0.08) 5px, rgba(51,150,255,0.08) 10px)' }} />
        <div className="relative flex items-center justify-center gap-2">
          <svg className="w-3 h-3 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          <p className="text-[9px] text-navy-500 dark:text-navy-400 text-center font-medium">Valid for one visit only. Carry at all times.</p>
        </div>
      </div>
    </div>
  );
}
