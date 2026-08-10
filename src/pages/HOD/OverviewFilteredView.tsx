import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import { formatTime, formatDuration } from '../../lib/formatDate';
import { STATUS_STYLES } from '../../lib/statusStyles';
import VisitorDetails from '../../components/VisitorDetails';
import CardField from '../../components/CardField';
import { CRISP_CARD_INTERACTIVE } from '../../lib/cardStyles';

type ViewMode = 'inside' | 'approved' | 'pending' | 'rejected';

type Props = {
  mode: ViewMode;
  visits: Visit[];
  loading: boolean;
  onClearFilter: () => void;
  acting?: string | null;
  reasons?: Record<string, string>;
  onReasonChange?: (id: string, value: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
};

const MODE_META: Record<ViewMode, { title: string; subtitle: string }> = {
  inside:   { title: 'Currently Inside',   subtitle: 'Checked-in visitors right now' },
  approved: { title: 'Approved Today',     subtitle: 'Pre-approved & walk-in approved visitors' },
  pending:  { title: 'Pending Walk-in Approvals', subtitle: 'Gate requests awaiting your decision' },
  rejected: { title: 'Rejected Today',     subtitle: 'Visitors denied entry today' },
};

export default function OverviewFilteredView({
  mode, visits, loading, onClearFilter, acting, reasons, onReasonChange, onApprove, onReject,
}: Props): React.ReactElement {
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);

  return (
    <div className="animate-fade-in space-y-4">
      {detailVisit && (
        <VisitorDetails
          visit={detailVisit}
          // /overview is HOD-only in ROLE_ROUTES — see the note in Approvals.tsx.
          viewerRole="hod"
          onClose={() => setDetailVisit(null)}
          acting={acting}
          reason={reasons?.[detailVisit.id] ?? ''}
          onReasonChange={onReasonChange ? (val) => onReasonChange(detailVisit.id, val) : undefined}
          onApprove={onApprove ? () => { onApprove(detailVisit.id); setDetailVisit(null); } : undefined}
          onReject={onReject ? () => { onReject(detailVisit.id); setDetailVisit(null); } : undefined}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">{MODE_META[mode].title}</h2>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">{MODE_META[mode].subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-navy-500 dark:text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
            {loading ? '—' : visits.length} {visits.length === 1 ? 'visitor' : 'visitors'}
          </span>
          {/* No "Clear All" on the approved list, and no per-visit cancel in
              the popup this list opens. A pre-approval is final once given —
              see the note in useVisitDecisions.ts. */}
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
        <div className="flex flex-col gap-4">
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

      {/* Visitor list — a full-width vertical stack, one card after another
          (client feedback, 2026-08-10 — see WhosInside.tsx for the same fix). */}
      {!loading && visits.length > 0 && (
        <div data-card-list className="flex flex-col gap-4">
          {visits.map((v, idx) => <VisitorCard key={v.id} visit={v} index={idx} onClick={() => setDetailVisit(v)} />)}
        </div>
      )}
    </div>
  );
}

const PURPOSE_LABELS: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

// Header = identity (photo, name) + state (status pill) only. Every other
// fact — vendor, department, reason, phone, date, ref — lives in the body
// grid below, exactly once. Vendor used to also print here under the name,
// duplicating the value the Field grid already shows (client feedback,
// 2026-08-10).
function VisitorCard({ visit: v, index: idx, onClick }: { visit: Visit; index: number; onClick: () => void }): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  const dur = v.status === 'checked_in' && v.checked_in_at ? formatDuration(v.checked_in_at) : null;
  const when = v.scheduled_for ?? v.created_at;
  const dateStr = new Date(when).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const timeStr = formatTime(when);

  return (
    <div
      data-card-header-root
      className={`${CRISP_CARD_INTERACTIVE} p-4 animate-fade-in`}
      style={{ animationDelay: `${idx * 0.03}s` }}
      onClick={onClick}
    >
      {/* Header — identity + state only */}
      <div data-card-header className="flex gap-3 items-center">
        <div className="shrink-0 relative">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-12 h-12 object-cover rounded-full ring-2 ring-brand-500/15" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-500/20 dark:to-accent-500/20 rounded-full flex items-center justify-center">
              <span className="text-base font-bold text-brand-500">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-h3 text-navy-950 dark:text-white truncate">{v.visitor?.full_name ?? '—'}</p>
        </div>
        <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${v.status === 'checked_in' ? 'animate-pulse-soft' : ''}`} />
          {style.label}
        </span>
      </div>

      {/* Body — every other fact, exactly once. Collapses to a single column
          below `sm` (375px) so nothing crowds on a phone at the gate. */}
      <div className="mt-3.5 pt-3.5 border-t border-surface-200/60 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
        <CardField label="Vendor" value={v.visitor?.vendor_name} />
        <CardField label="Department" value={v.department?.name} />
        <CardField label="Reason" value={PURPOSE_LABELS[v.purpose] ?? v.purpose} />
        <CardField label="Date" value={`${dateStr} · ${timeStr}`} />
        <CardField label="Phone" value={v.visitor?.phone} />
        <CardField label="Ref" value={v.ref_number} />
      </div>

      {/* Muted footer band — status context, the shadcn CardFooter idiom
          (distinct surface, not another bordered box nested inside this one). */}
      <div className="mt-3 -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl bg-surface-100/60 dark:bg-white/[0.03] border-t border-surface-200 dark:border-white/[0.06]">
        <div className="min-w-0">
          {/* Which approval route the visit took is already named on the badge
              above ('Pre-approved' vs 'Walk-in approved'), so this line carries
              the one thing both routes share once the HOD has decided: the visit
              is now waiting on the gate. */}
          {v.status === 'approved' && (
            <p className="text-caption text-success-600 dark:text-success-400 font-semibold truncate flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500 shrink-0" />
              Awaiting gate check{v.scheduled_for && ` · ETA ${formatTime(v.scheduled_for)}`}
            </p>
          )}
          {v.status === 'pending_approval' && (
            <p className="text-caption text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              Pending HOD Approval
            </p>
          )}
          {v.status === 'walkin_approved' && (
            <p className="text-caption text-brand-600 dark:text-brand-400 font-semibold truncate flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
              Awaiting gate check
            </p>
          )}
          {v.checked_in_at && v.status === 'checked_in' && (
            <p className={`text-caption font-semibold flex items-center gap-1 ${dur?.isOvertime ? 'text-danger-600' : 'text-brand-600 dark:text-brand-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dur?.isOvertime ? 'bg-danger-500' : 'bg-brand-500'}`} />
              {dur?.text} on-site{dur?.isOvertime ? ' — Overtime' : ''}
            </p>
          )}
          {v.rejection_reason && (
            <p className="text-caption text-danger-600 dark:text-danger-400 font-medium truncate flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-danger-500 shrink-0" />
              {v.rejection_reason}
            </p>
          )}
          {!v.rejection_reason && v.status !== 'approved' && v.status !== 'pending_approval'
            && v.status !== 'walkin_approved' && !(v.checked_in_at && v.status === 'checked_in') && (
            <p className="text-caption text-navy-500 dark:text-navy-400 font-medium">{style.label}</p>
          )}
        </div>
      </div>
    </div>
  );
}
