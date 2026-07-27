import React from 'react';
import type { Visit } from '../../types/index';
import { formatTime } from '../../lib/formatDate';
import { STATUS_STYLES } from '../../lib/statusStyles';

function purposeLabel(p: string): string {
  const map: Record<string, string> = {
    meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
    delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
  };
  return map[p] ?? p;
}

type Props = {
  mode: 'approved' | 'rejected';
  visits: Visit[];
  loading: boolean;
  acting: string | null;
  onViewDetails: (v: Visit) => void;
  onCancel?: (id: string) => void;
  onClearAll?: () => void;
};

export default function ApprovalsVisitList({ mode, visits, loading, acting, onViewDetails, onCancel, onClearAll }: Props): React.ReactElement {
  if (loading) return <div className="text-center py-12 text-navy-400">Loading...</div>;

  if (visits.length === 0) {
    const isApproved = mode === 'approved';
    return (
      <div className="empty-state py-16">
        <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-3 ${isApproved ? 'bg-success-50' : 'bg-surface-100'}`}>
          {isApproved ? (
            <svg className="w-7 h-7 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="w-7 h-7 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          )}
        </div>
        <p className="text-base font-semibold text-navy-700">No {mode} visitors</p>
        <p className="text-sm text-navy-400 mt-1">{isApproved ? 'Approved' : 'Rejected'} visitors will appear here</p>
      </div>
    );
  }

  if (mode === 'approved') {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center justify-between px-1 mb-1">
          <p className="text-sm font-bold text-navy-700">{visits.length} Approved</p>
          {onClearAll && (
            <button onClick={onClearAll} disabled={acting === 'clear-all'}
              className="text-xs font-semibold text-danger-600 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Clear All
            </button>
          )}
        </div>
        {visits.map((v) => {
          const style = STATUS_STYLES[v.status] ?? { bg: 'bg-surface-50', text: 'text-navy-700', label: v.status };
          return (
            <div key={v.id} className="card p-4 cursor-pointer animate-fade-in border-l-[3px] border-l-success-500 hover:shadow-sm transition-shadow" onClick={() => onViewDetails(v)}>
              <div className="flex gap-3 items-center">
                {v.photo_url ? (
                  <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0 ring-2 ring-success-100" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-success-50 to-success-100 rounded-lg shrink-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-success-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-navy-950 text-sm">{v.visitor?.full_name ?? '--'}</p>
                    <span className={`status-badge ${style.bg} ${style.text}`}>{style.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-100 text-navy-400">{purposeLabel(v.purpose)}</span>
                    <span className="text-xs text-navy-400 truncate">{v.host?.full_name ?? ''}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                  <p className="text-[10px] text-navy-300">{formatTime(v.checked_in_at ?? v.created_at)}</p>
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={(e) => { e.stopPropagation(); onViewDetails(v); }}
                      className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 flex items-center gap-0.5">
                      Open details
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                    </button>
                    {onCancel && (
                      <button onClick={(e) => { e.stopPropagation(); onCancel(v.id); }} disabled={acting === v.id}
                        className="text-[10px] font-semibold text-danger-500 hover:text-danger-700 flex items-center gap-0.5 disabled:opacity-50">
                        Cancel
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Rejected mode
  return (
    <div className="space-y-3 animate-fade-in">
      {visits.map((v) => (
        <div key={v.id} className="card p-4 cursor-pointer animate-fade-in border-l-[3px] border-l-danger-500 hover:shadow-sm transition-shadow" onClick={() => onViewDetails(v)}>
          <div className="flex gap-3 items-start">
            {v.photo_url ? (
              <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-danger-50 to-danger-100 rounded-lg shrink-0 flex items-center justify-center">
                <span className="text-sm font-bold text-danger-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-navy-950 text-sm">{v.visitor?.full_name ?? '--'}</p>
                <span className="status-badge bg-danger-50 text-danger-700">Rejected</span>
              </div>
              <p className="text-xs text-navy-400 truncate mt-0.5">
                {v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.host?.full_name ?? ''}
              </p>
              {v.rejection_reason && (
                <div className="mt-2 rounded-lg bg-danger-50/60 px-2.5 py-2 text-xs text-danger-700 border border-danger-100 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-danger-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {v.rejection_reason}
                </div>
              )}
            </div>
            <p className="text-[11px] text-navy-300 font-mono shrink-0">{v.ref_number}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
