import React from 'react';
import { getInitials } from '../../components/DailyVisitorTypes';
import { formatDateTime, formatTime } from '../../lib/formatDate';
import { CRISP_CARD_INTERACTIVE } from '../../lib/cardStyles';
import type { MatchItem } from './CheckInPanel';
import type { VisitStatus } from '../../types/index';

const APPROVAL_META: Record<MatchItem['approvalType'], { label: string; badge: string }> = {
  pre_approved:    { label: 'Pre-Approved',    badge: 'bg-success-50 text-success-700 border border-success-500/20' },
  walkin_approved: { label: 'Walk-in Approved', badge: 'bg-amber-50 text-amber-700 border border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/25' },
  recurring:       { label: 'Regular',          badge: 'bg-accent-50 text-accent-700 border border-accent-500/20 dark:bg-accent-500/10 dark:text-accent-300 dark:border-accent-500/25' },
};

// Closed/non-actionable pass states, surfaced so a search hit that cannot be
// checked in still tells the guard WHY. `checked_in` and `pending_approval`
// aren't "closed" exactly, but neither is checkable-in from this list either
// (checked_in has its own `isCheckedIn` badge below computed from a live
// checked-in-ids set, not from m.status, which is why it's handled separately
// rather than through this map — see the render guard below). Statuses left
// out here (`approved`, `walkin_approved`) are the checkable ones and need no
// badge at all.
const STATUS_META: Partial<Record<VisitStatus, { label: string; badge: string }>> = {
  checked_out:      { label: 'Checked Out',       badge: 'bg-navy-50 text-navy-600 border border-navy-500/15 dark:bg-white/[0.06] dark:text-navy-200' },
  rejected:         { label: 'Rejected',          badge: 'bg-danger-50 text-danger-700 border border-danger-500/20' },
  cancelled:        { label: 'Cancelled',         badge: 'bg-navy-50 text-navy-600 border border-navy-500/15 dark:bg-white/[0.06] dark:text-navy-200' },
  no_show:          { label: 'No Show',           badge: 'bg-danger-50 text-danger-700 border border-danger-500/20' },
  expired:          { label: 'Expired',           badge: 'bg-danger-50 text-danger-700 border border-danger-500/20' },
  checked_in:       { label: 'Inside Now',        badge: 'bg-brand-50 text-brand-700 border border-brand-500/20' },
  pending_approval: { label: 'Awaiting Approval', badge: 'bg-amber-50 text-amber-700 border border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/25' },
};

type Props = {
  match: MatchItem;
  disabled: boolean;
  isCheckedIn: boolean;
  expired: boolean;
  onSelect: () => void;
};

export default function CheckInMatchCard({ match: m, disabled, isCheckedIn, expired, onSelect }: Props): React.ReactElement {
  const approval = APPROVAL_META[m.approvalType];
  // Mutually exclusive with the three existing badges below: `isCheckedIn`
  // and `expired` come from the guard's own live computation (checkedInIds /
  // isExpired), not from m.status, so a row can satisfy one of those AND
  // have a status that would otherwise map to the same or a conflicting
  // label. Only fall through to the status badge when none of the other
  // three already explain why the row can't be acted on.
  const statusMeta = !isCheckedIn && !expired && m.dueToday && m.status ? STATUS_META[m.status] : undefined;

  return (
    <div
      className={`${CRISP_CARD_INTERACTIVE} p-4 flex items-start gap-3.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onClick={() => { if (!disabled) onSelect(); }}
    >
      <div className="h-11 w-11 rounded-2xl avatar-gradient flex items-center justify-center text-sm font-bold shrink-0">
        {getInitials(m.visitorName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-h3 text-navy-900 truncate">{m.visitorName}</p>
          <span className={`status-badge ${approval.badge}`}>{approval.label}</span>
          <span className="status-badge bg-navy-50 text-navy-600 border border-navy-500/15 dark:bg-white/[0.06] dark:text-navy-200">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* A bare time is only safe for a pass due TODAY. On a search hit
                for another day, "03:30" reads as an arrival that is due now,
                which is precisely the confusion the today-only board avoids —
                so a not-due row prints the date too. */}
            {m.scheduledFor
              ? (m.dueToday ? formatTime(m.scheduledFor) : formatDateTime(m.scheduledFor))
              : 'Anytime today'}
          </span>
          {isCheckedIn && <span className="status-badge bg-brand-50 text-brand-700 border border-brand-500/20">Checked In</span>}
          {expired && !isCheckedIn && <span className="status-badge bg-danger-50 text-danger-700 border border-danger-500/20">Expired</span>}
          {!m.dueToday && !expired && !isCheckedIn && (
            <span className="status-badge bg-amber-50 text-amber-700 border border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/25">
              Not due today
            </span>
          )}
          {statusMeta && <span className={`status-badge ${statusMeta.badge}`}>{statusMeta.label}</span>}
        </div>

        <p className="text-caption text-navy-500 dark:text-navy-400 mt-1 truncate">{m.purpose}</p>

        <div className="flex flex-col gap-1 mt-2 text-caption text-navy-500">
          {m.hostName && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
              {/* Department moved here, under the host's name, instead of
                  staying paired with purpose above — that combination
                  duplicated the same department value on this card. */}
              <span className="truncate">
                Person to Meet: <span className="font-semibold text-navy-700">{m.hostName}</span>
                {m.departmentName && <span className="block text-[11px] text-navy-500 dark:text-navy-400">{m.departmentName}</span>}
              </span>
            </span>
          )}
          {m.vendorName && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3.75h15v16.5h-15V3.75zM9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5M13.5 6.75H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <span className="truncate">{m.vendorName}</span>
            </span>
          )}
          {m.approvedAt && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="truncate">{approval.label} on <span className="font-semibold text-navy-700">{formatDateTime(m.approvedAt)}</span></span>
            </span>
          )}
        </div>
      </div>

      {!disabled && (
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
          Check In
        </button>
      )}
    </div>
  );
}
