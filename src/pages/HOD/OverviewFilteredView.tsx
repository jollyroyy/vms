import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import { formatTime, formatDuration } from '../../lib/formatDate';
import { STATUS_STYLES } from '../../lib/statusStyles';
import VisitorDetails from '../../components/VisitorDetails';

type ViewMode = 'inside' | 'approved' | 'pending' | 'rejected';

type Props = {
  mode: ViewMode;
  visits: Visit[];
  loading: boolean;
  onClearFilter: () => void;
};

const MODE_META: Record<ViewMode, { title: string; subtitle: string }> = {
  inside:   { title: 'Currently Inside',   subtitle: 'Checked-in visitors right now' },
  approved: { title: 'Approved Today',     subtitle: 'Pre-approved & walk-in approved visitors' },
  pending:  { title: 'Pending Approval',   subtitle: 'Visitors awaiting your decision' },
  rejected: { title: 'Rejected Today',     subtitle: 'Visitors denied entry today' },
};

export default function OverviewFilteredView({ mode, visits, loading, onClearFilter }: Props): React.ReactElement {
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);

  return (
    <div className="animate-fade-in space-y-4">
      {detailVisit && <VisitorDetails visit={detailVisit} onClose={() => setDetailVisit(null)} />}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">{MODE_META[mode].title}</h2>
          <p className="text-xs text-navy-400 mt-0.5">{MODE_META[mode].subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
            {loading ? '—' : visits.length} {visits.length === 1 ? 'visitor' : 'visitors'}
          </span>
          <button
            onClick={onClearFilter}
            className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
          >
            Back to overview
          </button>
        </div>
      </div>

      {/* Premium summary card for Approved */}
      {mode === 'approved' && !loading && (
        <div className="bg-gradient-to-br from-success-500 via-success-600 to-emerald-700 rounded-2xl p-5 shadow-glow-sm border border-success-400/30">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">Today's Approvals</p>
              <p className="text-4xl font-bold font-display tabular-nums mt-1">{visits.length}</p>
              <p className="text-sm font-medium text-white/80 mt-0.5">visitor{visits.length !== 1 ? 's' : ''} approved today</p>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/15 flex items-center justify-center ring-2 ring-white/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-white/[0.04] rounded-xl border border-surface-200 p-4">
              <div className="flex gap-3">
                <div className="w-12 h-16 skeleton rounded-xl shrink-0" />
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

      {/* Empty state */}
      {!loading && visits.length === 0 && (
        <div className="py-16 flex flex-col items-center text-center">
          <svg className="w-10 h-10 text-surface-300 dark:text-navy-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No {mode === 'inside' ? 'visitors inside' : mode === 'approved' ? 'approvals today' : mode === 'pending' ? 'pending requests' : 'rejected entries'}</p>
        </div>
      )}

      {/* Visitor grid — not loading and non-empty */}
      {!loading && visits.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visits.map((v, idx) => <VisitorCard key={v.id} visit={v} index={idx} onClick={() => setDetailVisit(v)} />)}
        </div>
      )}
    </div>
  );
}

function VisitorCard({ visit: v, index: idx, onClick }: { visit: Visit; index: number; onClick: () => void }): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  const dur = v.status === 'checked_in' && v.checked_in_at ? formatDuration(v.checked_in_at) : null;
  return (
    <div
      className="bg-white dark:bg-white/[0.04] rounded-xl border border-surface-200 p-4 cursor-pointer card-hover animate-fade-in"
      style={{ animationDelay: `${idx * 0.03}s` }}
      onClick={onClick}
    >
      <div className="flex gap-3 items-start">
        <div className="shrink-0 relative">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-12 h-16 object-cover rounded-xl ring-2 ring-brand-500/10" />
          ) : (
            <div className="w-12 h-16 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-navy-900 dark:text-white truncate text-sm">{v.visitor?.full_name ?? '—'}</p>
            <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${v.status === 'checked_in' ? 'animate-pulse-soft' : ''}`} />
              {style.label}
            </span>
          </div>
          {v.visitor?.company && <p className="text-xs text-navy-400 truncate mt-0.5">{v.visitor.company}</p>}
          <div className="mt-2 pt-2 border-t border-surface-200/60 dark:border-white/[0.06] space-y-1">
            <p className="text-xs font-semibold text-navy-600 dark:text-navy-300 truncate">{v.department?.name ?? '—'}</p>
            {v.host?.full_name && <p className="text-xs text-navy-400 truncate">Host: {v.host.full_name}</p>}
            <p className="text-[10px] text-navy-300 font-mono">{v.ref_number}</p>
            <div className="mt-1.5 space-y-0.5">
              {v.status === 'approved' && (
                <p className="text-[11px] text-success-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                  Awaiting Arrival
                  {v.scheduled_for && <span className="text-navy-300 font-normal ml-1">· ETA {formatTime(v.scheduled_for)}</span>}
                </p>
              )}
              {v.status === 'pending_approval' && (
                <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Pending HOD Approval
                </p>
              )}
              {v.status === 'walkin_approved' && (
                <p className="text-[11px] text-brand-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  Walk-in Approved — Awaiting Check-in
                </p>
              )}
              {v.checked_in_at && (
                <p className="text-[11px] text-brand-600 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Checked in at {formatTime(v.checked_in_at)}
                </p>
              )}
            </div>
            {dur && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-400'}`}>
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {dur.text} on-site{dur.isOvertime ? ' — Overtime' : ''}
              </p>
            )}
            {v.rejection_reason && (
              <p className="text-[11px] text-danger-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {v.rejection_reason}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
