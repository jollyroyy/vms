import React from 'react';
import { formatDateTime } from '../../lib/formatDate';
import { useLiveElapsed } from '../../lib/useLiveElapsed';
import { approvalTimestamp } from '../../lib/visitApproval';
import type { ReportVisit } from '../../lib/reportRow';
import { STATUS_STYLES } from '../../lib/statusStyles';

type Props = {
  visit: ReportVisit;
  index: number;
  onClick: () => void;
};

type Tone = 'success' | 'brand' | 'warning' | 'muted' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10',
  muted: 'bg-surface-100 text-navy-400',
  danger: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10',
};

// `strong` promotes a row to the one the guard is meant to read first — larger,
// darker and in tabular figures so a ticking duration does not jitter sideways
// as the digits change width.
function TimelineRow({ tone, icon, label, value, live, strong }: { tone: Tone; icon: React.ReactNode; label: string; value: React.ReactNode; live?: boolean; strong?: boolean }): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${TONE_CLASSES[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-navy-500">{label}</p>
        <p className={`truncate tabular-nums ${strong ? 'text-[15px] font-bold leading-snug text-navy-950' : 'text-[13px] font-semibold leading-snug text-navy-800'}`}>
          {value}
          {live && (
            <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[10px] font-bold uppercase tracking-wide text-success-600">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse-soft" />Live
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export default function WhosInsideVisitorCard({ visit: v, index: idx, onClick }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  const isInside = v.status === 'checked_in';
  const elapsed = useLiveElapsed(v.checked_in_at, v.checked_out_at);
  const duration = v.checked_in_at ? elapsed : null;
  const approvedAt = approvalTimestamp(v);

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
            <p className="font-bold text-navy-950 truncate text-[15px] leading-tight tracking-tight">{v.visitor?.full_name ?? '—'}</p>
            <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${isInside ? 'animate-pulse-soft' : ''}`} />
              {style.label}
            </span>
          </div>
          {v.visitor?.vendor_name && <p className="text-[13px] text-navy-500 truncate mt-0.5">{v.visitor.vendor_name}</p>}
          <div className="mt-2 pt-2 border-t border-surface-200/60 dark:border-white/[0.06] space-y-1">
            {/* Department used to be its own bare line above Host, independent
                of whether a host was even known — that rendered the same
                department value a guard could also see on the popup, and a
                department with no name above it read as orphaned. It now
                lives under the host's name, and only when there is a name
                for it to sit under. */}
            {v.host?.full_name && (
              <>
                <p className="text-[11px] text-navy-400 uppercase tracking-wide">Person to Meet</p>
                <p className="text-[13px] font-bold text-navy-800 truncate">{v.host.full_name}</p>
                {v.department?.name && <p className="text-[13px] text-navy-500 truncate">{v.department.name}</p>}
              </>
            )}
            <p className="text-[11px] text-navy-400 font-mono tracking-wide">{v.ref_number}</p>
            {!isInside && (
              <p className={`text-[12px] font-bold flex items-center gap-1.5 ${v.status === 'pending_approval' ? 'text-warning-700' : 'text-success-700'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${v.status === 'pending_approval' ? 'bg-warning-500 animate-pulse' : 'bg-success-500'}`} />
                {v.status === 'pending_approval' ? 'Pending HOD Approval'
                  : v.status === 'walkin_approved' ? 'Walk-in Approved — Awaiting Check-in'
                  : 'Pre-approved — Awaiting Arrival'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-gradient-to-b from-surface-50/80 to-surface-100/40 border border-surface-200/60 dark:border-white/[0.06] p-3 space-y-2.5">
        {/* Approval and check-in are separate events and were previously
            collapsed into one row that only ever showed the check-in time. */}
        <TimelineRow
          tone={approvedAt ? 'success' : 'warning'}
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Approved"
          value={approvedAt ? formatDateTime(approvedAt) : 'Not yet approved'}
        />
        <TimelineRow
          tone={v.checked_in_at ? 'success' : 'warning'}
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" /></svg>}
          label="Check-in"
          value={v.checked_in_at ? formatDateTime(v.checked_in_at) : 'Not yet checked in'}
        />
        <TimelineRow
          tone={v.checked_out_at ? 'brand' : 'muted'}
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>}
          label="Check-out"
          value={v.checked_out_at ? formatDateTime(v.checked_out_at) : 'Not yet checked out'}
        />
        <TimelineRow
          tone={duration?.isOvertime ? 'danger' : 'brand'}
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Duration Inside"
          value={duration ? `${duration.text}${duration.isOvertime ? ' — Overtime' : ''}` : '—'}
          live={isInside}
          strong
        />
      </div>
    </div>
  );
}
