import React from 'react';
import type { Visit } from '../../types/index';
import { formatTime, formatDuration } from '../../lib/formatDate';
import { STATUS_STYLES } from '../../lib/statusStyles';

type Props = {
  visit: Visit;
  index: number;
  onClick: () => void;
};

export default function WhosInsideVisitorCard({ visit: v, index: idx, onClick }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  const dur = v.status === 'checked_in' && v.checked_in_at ? formatDuration(v.checked_in_at) : null;
  return (
    <div
      className="card card-hover p-4 cursor-pointer animate-fade-in"
      style={{ animationDelay: `${idx * 0.03}s` }}
      onClick={onClick}
    >
      <div className="flex gap-3 items-start">
        <div className="shrink-0 relative">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-12 h-16 object-cover rounded-xl ring-2 ring-brand-500/10" />
          ) : (
            <div className="w-12 h-16 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-navy-900 truncate text-sm">{v.visitor?.full_name ?? '—'}</p>
            <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${style.dot} ${v.status === 'checked_in' ? 'animate-pulse-soft' : ''}`}
              />
              {style.label}
            </span>
          </div>
          {v.visitor?.company && <p className="text-xs text-navy-400 truncate">{v.visitor.company}</p>}
          {/* Department + Host */}
          <div className="mt-2 pt-2 border-t border-surface-200/60 dark:border-white/[0.06] space-y-1">
            <p className="text-xs font-semibold text-navy-600 truncate">{v.department?.name ?? '—'}</p>
            {v.host?.full_name && <p className="text-xs text-navy-400 truncate">Host: {v.host.full_name}</p>}
            <p className="text-[10px] text-navy-300 font-mono">{v.ref_number}</p>
            {/* Live status timeline */}
            <div className="mt-1.5 space-y-0.5">
              {v.status === 'approved' && (
                <p className="text-[11px] text-success-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                  Awaiting Arrival
                  {v.scheduled_for && <span className="text-navy-300 font-normal ml-1">· ETA {formatTime(v.scheduled_for)}</span>}
                </p>
              )}
              {v.status === 'pending_approval' && (
                <p className="text-[11px] text-warning-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning-500 animate-pulse" />
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
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Checked in at {formatTime(v.checked_in_at)}
                </p>
              )}
              {v.checked_out_at && (
                <p className="text-[11px] text-navy-400 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                  Checked out at {formatTime(v.checked_out_at)}
                </p>
              )}
            </div>
            {dur && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-400'}`}>
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {dur.text} on-site{dur.isOvertime ? ' — Overtime' : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
