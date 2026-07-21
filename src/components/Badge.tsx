/**
 * Badge — FR-VIS-05
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Visit } from '../types/index';

type Props = { visit: Visit };

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
    <div className="print-only mx-auto w-72 rounded-2xl border-2 border-navy-800 bg-white shadow-elevated overflow-hidden">
      <div className="bg-navy-900 px-5 py-3 text-center">
        <p className="text-[11px] font-bold text-brand-300 uppercase tracking-[0.15em]">Visitor Pass</p>
        <p className="text-[11px] text-navy-400 mt-0.5 font-mono">{visit.ref_number}</p>
      </div>
      <div className="p-5 space-y-4">
        {visit.photo_url ? (
          <img src={visit.photo_url} alt="Visitor" className="w-28 h-36 object-cover rounded-xl mx-auto block" />
        ) : (
          <div className="w-28 h-36 bg-surface-100 rounded-xl mx-auto flex items-center justify-center text-surface-300">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
          </div>
        )}
        <div className="text-center space-y-0.5">
          <p className="font-bold text-navy-950 text-lg">{visitor?.full_name ?? '—'}</p>
          <p className="text-sm text-navy-400">{visitor?.company ?? ''}</p>
        </div>
        <div className="text-xs text-navy-600 space-y-2 border-t border-surface-200 pt-3">
          <div className="flex justify-between"><span className="text-navy-400">Department</span><span className="font-medium">{dept?.name ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-navy-400">Host</span><span className="font-medium">{host?.full_name ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-navy-400">Date</span><span className="font-medium">{new Date(visit.created_at).toLocaleDateString('en-IN')}</span></div>
          <div className="flex justify-between"><span className="text-navy-400">Status</span><span className="capitalize font-semibold text-brand-700">{visit.status.replace('_', ' ')}</span></div>
        </div>
        <div className="flex flex-col items-center gap-1.5 pt-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-16 h-16" />
          ) : (
            <div className="w-16 h-16 border-2 border-navy-800 rounded-xl flex items-center justify-center text-xs text-navy-400 bg-surface-50 animate-pulse">QR</div>
          )}
          <p className="text-[10px] text-navy-300">Scan at exit</p>
        </div>
      </div>
      <div className="bg-surface-50 px-5 py-2 border-t border-surface-200">
        <p className="text-[9px] text-navy-300 text-center">Valid for one visit only. Carry at all times.</p>
      </div>
    </div>
  );
}
