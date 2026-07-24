/**
 * Badge — FR-VIS-05
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Visit } from '../types/index';

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
    if (visit?.ref_number) {
      QRCode.toDataURL(`vms://visit/${visit.ref_number}`, { width: 128, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
  }, [visit?.ref_number]);

  return (
    <div className="print-only mx-auto w-72 rounded-2xl bg-white overflow-hidden" style={{ border: '2px solid transparent', backgroundClip: 'padding-box', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12), 0 0 0 2px #1e293b' }}>
      {/* Premium header with brand gradient */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-brand-900 px-5 py-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(51,150,255,0.12),transparent)]" />
        <div className="relative">
          <p className="text-[12px] font-bold text-white uppercase tracking-[0.2em]">Visitor Pass</p>
          <p className="text-[11px] text-brand-300 mt-1 font-mono tracking-wider">{visit.ref_number}</p>
        </div>
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
          <p className="text-sm text-navy-400 font-medium">{visitor?.company ?? ''}</p>
        </div>

        {/* Info rows with clean separators */}
        <div className="text-xs text-navy-600 space-y-0 border-t border-surface-200 pt-3">
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-400 font-medium">Department</span>
            <span className="font-semibold text-navy-700">{dept?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-400 font-medium">Host</span>
            <span className="font-semibold text-navy-700">{host?.full_name ?? '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-400 font-medium">Purpose</span>
            <span className="font-semibold text-navy-700">{formatPurpose(visit.purpose)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-100">
            <span className="text-navy-400 font-medium">Date</span>
            <span className="font-semibold text-navy-700">{new Date(visit.created_at).toLocaleDateString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-navy-400 font-medium">Status</span>
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
            <div className="w-16 h-16 border-2 border-navy-800 rounded-xl flex items-center justify-center text-xs text-navy-400 bg-surface-50 animate-pulse">QR</div>
          )}
          <p className="text-[10px] text-navy-300 font-medium">Scan at exit</p>
        </div>
      </div>

      {/* Premium footer with hologram-style effect */}
      <div className="px-5 py-3 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f4f4f5, #eef8ff, #f4f4f5)', borderTop: '1px solid rgba(228,228,231,0.6)' }}>
        <div className="absolute inset-0 opacity-20" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(51,150,255,0.08) 5px, rgba(51,150,255,0.08) 10px)' }} />
        <div className="relative flex items-center justify-center gap-2">
          <svg className="w-3 h-3 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          <p className="text-[9px] text-navy-400 text-center font-medium">Valid for one visit only. Carry at all times.</p>
        </div>
      </div>
    </div>
  );
}
