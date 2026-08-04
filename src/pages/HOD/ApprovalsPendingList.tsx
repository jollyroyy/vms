import React, { useState } from 'react';
import type { Visit } from '../../types/index';

const PURPOSE_MAP: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Props = {
  visits: Visit[];
  loading: boolean;
  error: string;
  acting: string | null;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onDecide: (id: string, approved: boolean) => void;
  onViewDetails: (v: Visit) => void;
};

export default function ApprovalsPendingList({ visits, loading, error, acting, reasons, onReasonChange, onDecide, onViewDetails }: Props): React.ReactElement {
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  return (
    <div className="space-y-3 animate-fade-in">
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton w-2/3" />
                  <div className="h-3 skeleton w-1/2" />
                  <div className="h-3 skeleton w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visits.length === 0 && !error && (
        <div className="empty-state py-16">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 mb-3">
            <svg className="w-7 h-7 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-base font-semibold text-navy-700">All caught up</p>
          <p className="text-sm text-navy-400 mt-1">No pending approvals right now</p>
        </div>
      )}

      {visits.map((v, idx) => {
        const isRejecting = rejectingId === v.id;
        return (
          <div key={v.id} className="card overflow-hidden animate-fade-in" style={{ animationDelay: `${idx * 0.04}s` }}>
            <div className="p-4">
              <div className="flex gap-3 cursor-pointer" onClick={() => onViewDetails(v)}>
                {v.photo_url ? (
                  <img src={v.photo_url} alt="" className="w-11 h-11 object-cover rounded-xl shrink-0 ring-2 ring-surface-100" />
                ) : (
                  <div className="w-11 h-11 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl shrink-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-brand-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-navy-950 dark:text-white">{v.visitor?.full_name ?? '--'}</p>
                    <span className="status-badge bg-warning-50 text-warning-700">Pending</span>
                    <span className="ml-auto text-[10px] text-navy-300 font-mono">{v.ref_number}</span>
                  </div>
                  {v.visitor?.vendor_name && (
                    <p className="text-xs text-navy-400 truncate mt-0.5">{v.visitor.vendor_name}</p>
                  )}
                  {v.host?.full_name && (
                    <p className="text-xs text-navy-400 truncate mt-0.5">Person to Meet: {v.host.full_name}</p>
                  )}
                  {v.host?.full_name && v.department?.name && (
                    <p className="text-xs text-navy-400 truncate">{v.department.name}</p>
                  )}
                  {v.visitor?.phone && (
                    <p className="text-xs text-navy-400 truncate mt-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                      {v.visitor.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-brand-100">
                      {PURPOSE_MAP[v.purpose] ?? v.purpose}
                    </span>
                    <span className="text-[10px] text-navy-300 ml-auto">{timeAgo(v.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-surface-200/60 dark:border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
                {isRejecting ? (
                  <div className="space-y-2.5">
                    <input type="text" maxLength={500} autoFocus placeholder="Rejection reason (required to reject)"
                      value={reasons[v.id] ?? ''} onChange={(e) => onReasonChange(v.id, e.target.value)} className="input" />
                    <div className="flex gap-2.5">
                      <button onClick={() => setRejectingId(null)}
                        className="flex-1 rounded-xl border border-surface-200 bg-surface-50 text-navy-500 hover:bg-surface-100 py-2.5 text-sm font-semibold transition-all">
                        Cancel
                      </button>
                      <button onClick={() => { onDecide(v.id, false); setRejectingId(null); }}
                        disabled={acting === v.id || !(reasons[v.id] ?? '').trim()}
                        className="flex-1 rounded-xl bg-danger-600 hover:bg-danger-700 text-white py-2.5 text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.98]">
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    <button onClick={() => onViewDetails(v)}
                      className="px-3 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-navy-500 hover:bg-surface-100 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Details
                    </button>
                    <button onClick={() => onDecide(v.id, true)} disabled={acting === v.id}
                      className="btn-accent flex-1 !py-2.5 flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Approve
                    </button>
                    <button onClick={() => setRejectingId(v.id)} disabled={acting === v.id}
                      className="flex-1 rounded-xl border border-danger-500/30 bg-danger-50/60 text-danger-700 hover:bg-danger-100 py-2.5 text-sm font-semibold disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
