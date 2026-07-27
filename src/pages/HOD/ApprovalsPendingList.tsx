import React from 'react';
import type { Visit } from '../../types/index';
import { getEscalationTarget } from '../../lib/escalation';

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

function escalationLabel(v: Visit): { text: string; urgent: boolean } {
  const now = new Date().toISOString();
  const target = getEscalationTarget(v.created_at, now, { hod_id: 'self', delegate_id: null });
  if (target === 'hod') {
    const mins = Math.floor((new Date().getTime() - new Date(v.created_at).getTime()) / 60000);
    const remaining = 5 - mins;
    if (remaining <= 0) return { text: 'Escalation imminent', urgent: true };
    return { text: `${remaining}m left`, urgent: remaining <= 2 };
  }
  if (target === 'delegate') return { text: 'Escalated to delegate', urgent: true };
  if (target === 'admin') return { text: 'Escalated to Admin', urgent: true };
  return { text: 'Pending', urgent: false };
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
        const esc = escalationLabel(v);
        return (
          <div key={v.id} className="card overflow-hidden animate-fade-in" style={{ animationDelay: `${idx * 0.04}s` }}>
            <div className={`px-4 py-2 text-[11px] font-semibold flex items-center gap-2 ${
              esc.urgent ? 'bg-danger-600 text-white' : 'bg-surface-100/60 text-navy-500 border-b border-surface-200/60 dark:border-white/[0.06]'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${esc.urgent ? 'bg-white animate-pulse' : 'bg-warning-500'}`} />
              {esc.text}
              <span className="ml-auto text-[10px] opacity-70 font-mono">{v.ref_number}</span>
            </div>
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
                    <p className="font-semibold text-navy-950">{v.visitor?.full_name ?? '--'}</p>
                    <span className="status-badge bg-warning-50 text-warning-700">Pending</span>
                  </div>
                  <p className="text-xs text-navy-400 truncate mt-0.5">
                    {v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.host?.full_name ?? ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-brand-100">
                      {PURPOSE_MAP[v.purpose] ?? v.purpose}
                    </span>
                    <span className="text-[10px] text-navy-300 ml-auto">{timeAgo(v.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-surface-200/60 dark:border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
                <input type="text" maxLength={500} placeholder="Rejection reason (required to reject)"
                  value={reasons[v.id] ?? ''} onChange={(e) => onReasonChange(v.id, e.target.value)} className="input mb-2.5" />
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
                  <button onClick={() => onDecide(v.id, false)} disabled={acting === v.id}
                    className="flex-1 rounded-xl border border-danger-500/30 bg-danger-50/60 text-danger-700 hover:bg-danger-100 py-2.5 text-sm font-semibold disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
