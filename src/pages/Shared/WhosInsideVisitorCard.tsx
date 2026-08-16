import React from 'react';
import { formatDateTime } from '../../lib/formatDate';
import { useLiveElapsed } from '../../lib/useLiveElapsed';
import { approvalTimestamp } from '../../lib/visitApproval';
import type { ReportVisit } from '../../lib/reportRow';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { visitOrigin, visitOriginLabel, statusProvesOrigin } from '../../lib/visitOrigin';
import CardField from '../../components/CardField';
import { CRISP_CARD_INTERACTIVE, CARD_FOOTER_BAND } from '../../lib/cardStyles';

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
  muted: 'bg-surface-100 text-navy-500 dark:text-navy-400',
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
        <p className="text-micro uppercase text-navy-500">{label}</p>
        <p className={`truncate tabular-nums leading-snug ${strong ? 'text-body-lg font-bold text-navy-950' : 'text-body font-medium text-navy-800'}`}>
          {value}
          {live && (
            <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-micro uppercase text-success-600">
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
      className={`${CRISP_CARD_INTERACTIVE} animate-fade-in`}
      style={{ animationDelay: `${idx * 0.03}s` }}
      onClick={onClick}
    >
      {/* Header — identity (photo, visitor name) + state (status pill) ONLY.
          Vendor, host and department used to also print here, duplicating the
          same values the field grid below shows (client feedback, 2026-08-10:
          "I see the vendor name in the body and also on the top"). */}
      <div data-card-header className="flex gap-3 items-start p-4">
        <div className="shrink-0 relative">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-12 h-16 object-cover rounded-xl ring-2 ring-brand-500/10" />
          ) : (
            <div className="w-12 h-16 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <p className="text-h3 text-navy-950 truncate">{v.visitor?.full_name ?? '—'}</p>
          <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${isInside ? 'animate-pulse-soft' : ''}`} />
            {style.label}
          </span>
        </div>
      </div>

      {/* Body — every other fact, exactly once, as a labelled field grid.
          Collapses to one column below `sm` (375px) so nothing crowds on a
          phone at the gate. */}
      <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5 border-t border-surface-200/60 dark:border-white/[0.06] pt-3">
        <CardField label="Vendor" value={v.visitor?.vendor_name} />
        {/* Booked ahead or turned up unannounced (client instruction,
            2026-08-16). Rendered only once the STATUS has stopped saying it:
            STATUS_STYLES.approved already reads "Pre-approved", so on an
            unconverged row this would be the same fact twice on one card. It is
            the converged statuses — checked_in and after — where the badge goes
            quiet, which is the whole population of this page. */}
        {!statusProvesOrigin(v.status) && (
          <CardField label="Type of Visitor" value={visitOriginLabel(visitOrigin(v))} />
        )}
        <CardField label="Person to Meet" value={v.host?.full_name} />
        <CardField label="Department" value={v.department?.name} />
        <CardField label="Ref" value={v.ref_number} className="font-mono" />
      </div>
      {!isInside && (
        <p className={`px-4 pb-3 text-caption font-semibold flex items-center gap-1.5 ${v.status === 'pending_approval' ? 'text-warning-700' : 'text-success-700'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${v.status === 'pending_approval' ? 'bg-warning-500 animate-pulse' : 'bg-success-500'}`} />
          {v.status === 'pending_approval' ? 'Pending HOD Approval'
            : v.status === 'walkin_approved' ? 'Walk-in Approved — Awaiting Check-in'
            : 'Pre-approved — Awaiting Arrival'}
        </p>
      )}

      {/* Footer — the shadcn CardFooter idiom: a distinct muted band, not a
          bordered box nested inside the card. Horizontal 2-column strip of
          labelled facts on `sm` and up, one column on a phone. */}
      <div className={`${CARD_FOOTER_BAND} rounded-b-2xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5`}>
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
