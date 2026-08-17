import React from 'react';
import { getInitials } from '../../components/DailyVisitorTypes';
import { formatDateTime } from '../../lib/formatDate';
import { CRISP_CARD, CRISP_CARD_INTERACTIVE } from '../../lib/cardStyles';
import type { MatchItem } from './checkInTypes';
import type { VisitStatus } from '../../types/index';

// THE TYPE OF VISITOR, in the same two words `lib/visitOrigin.ts` prints on the
// dashboard column, the Entry & Exit table and the visitor cards (client
// instruction, 2026-08-16). They used to read "Pre-Approved" / "Walk-in
// Approved" — close enough to look deliberate, different enough that a guard
// comparing this row against the board could not be sure it was the same fact.
// "Walk-in Approved" was wrong in a second way as well: it named the clearance,
// not the visitor, on a lane where an unapproved walk-in can also appear.
const APPROVAL_META: Record<MatchItem['approvalType'], { label: string; badge: string }> = {
  pre_approved: { label: 'Pre-approved', badge: 'bg-success-50 text-success-700 border border-success-500/20' },
  walk_in:      { label: 'Walk-in',      badge: 'bg-amber-50 text-amber-700 border border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/25' },
  recurring:    { label: 'Regular',      badge: 'bg-accent-50 text-accent-700 border border-accent-500/20 dark:bg-accent-500/10 dark:text-accent-300 dark:border-accent-500/25' },
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
  /** Take this visitor OUT (client instruction, 2026-08-17). Passed only where
   *  the surface can actually complete an exit, so a row that offers it is a
   *  row where pressing it does something. */
  onCheckOut?: () => void;
};

export default function CheckInMatchCard({
  match: m, disabled, isCheckedIn, expired, onSelect, onCheckOut,
}: Props): React.ReactElement {
  // EXACTLY ONE ACTION PER ROW, decided by where the visitor actually is
  // (client instruction, 2026-08-17). A guard who has just found somebody has
  // one thing to do about them: let them in, or let them out. Offering both, or
  // offering neither and making them navigate to another tab, is the
  // navigation this surface exists to remove.
  //
  // Check-out wins whenever the visit is `checked_in`, and it is deliberately
  // NOT gated on `disabled`: that flag means "cannot be checked IN", which is
  // exactly what a person already inside is.
  const canCheckOut = Boolean(onCheckOut) && m.status === 'checked_in';
  const approval = APPROVAL_META[m.approvalType];
  // Mutually exclusive with the three existing badges below: `isCheckedIn`
  // and `expired` come from the guard's own live computation (checkedInIds /
  // isExpired), not from m.status, so a row can satisfy one of those AND
  // have a status that would otherwise map to the same or a conflicting
  // label. Only fall through to the status badge when none of the other
  // three already explain why the row can't be acted on.
  const statusMeta = !isCheckedIn && !expired && m.dueToday && m.status ? STATUS_META[m.status] : undefined;

  return (
    // A ROW THAT CANNOT BE ACTED ON IS STILL FULLY LEGIBLE (client instruction,
    // 2026-08-17: searching by mobile number "should not be grayed out, it
    // should be properly showing all the details").
    //
    // It used to carry `opacity-50 pointer-events-none`, and the dimming was
    // the wrong tool for the job it was doing. What is unavailable here is the
    // CHECK-IN, not the record — this search deliberately spans every status
    // precisely so a guard can find out what became of a pass, and half-fading
    // the answer makes the times, the phone number and the host harder to read
    // exactly when they are the only thing the row has to offer. The row is
    // non-actionable by construction already: the Check In button does not
    // render and `onSelect` is gated below. So the disabled state now drops the
    // click AFFORDANCE (no pointer cursor, no hover lift) and keeps full
    // contrast. `pointer-events-none` went with the opacity — it also blocked
    // selecting the phone number to copy it, on the one card built to show it.
    <div
      className={`${disabled && !canCheckOut ? CRISP_CARD : CRISP_CARD_INTERACTIVE} p-4 flex items-start gap-3.5`}
      onClick={() => { if (canCheckOut) onCheckOut?.(); else if (!disabled) onSelect(); }}
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
            {/* Date AND time on every row (client instruction, 2026-08-13).
                It used to print a bare time for a pass due today and the full
                date only for a search hit on another day — the not-due half of
                that was load-bearing, since "03:30" alone reads as an arrival
                due now, and printing it everywhere is the same guarantee
                without asking the guard to notice which format they got. */}
            {m.scheduledFor ? formatDateTime(m.scheduledFor) : 'Anytime today'}
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
          {/* The mobile number (client instruction, 2026-08-17). Half of what
              a guard types into this box IS a phone number, and the row it
              found could not show it back — so a search that matched the wrong
              Sharma gave the guard no way to tell. It has been on `MatchItem`
              since the type was written; only the rendering was missing. */}
          {m.visitorPhone && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <span className="truncate tabular-nums">{m.visitorPhone}</span>
            </span>
          )}
          {/* THE THREE INSTANTS, EACH ON ITS OWN LINE AND EACH NAMED (client
              instruction, 2026-08-17: a checked-out visitor must show "checked
              out at", "pre-approved at" and "checked in at" with the date and
              the time — "don't vaguely mention it").
              Checked Out used to be an 11px sub-line hanging off Checked In,
              which made the one fact a guard is asking about — has this person
              already left? — the smallest text on the card. Every value is
              `formatDateTime`, so each carries its own date and none of them
              has to be read against the row above it.
              Absent rather than dashed: an em dash beside "Checked out" on a
              visitor who is still inside restates the status badge in a weaker
              form, and each of these is only ever a fact once it exists. */}
          {m.approvedAt && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {/* "Approved at", not "Pre-approved at" — the badge beside the
                  name already prints the desk, and the same word twice on one
                  card is the duplicate-render rule. This row is about WHEN. */}
              <span className="truncate">
                Approved at <span className="font-semibold text-navy-700">{formatDateTime(m.approvedAt)}</span>
              </span>
            </span>
          )}
          {m.checkedInAt && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
              </svg>
              <span className="truncate">
                Checked in at <span className="font-semibold text-navy-700">{formatDateTime(m.checkedInAt)}</span>
              </span>
            </span>
          )}
          {m.checkedOutAt && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <span className="truncate">
                Checked out at <span className="font-semibold text-navy-700">{formatDateTime(m.checkedOutAt)}</span>
              </span>
            </span>
          )}
        </div>
      </div>

      {canCheckOut ? (
        <button onClick={(e) => { e.stopPropagation(); onCheckOut?.(); }}
          className="shrink-0 bg-navy-800 hover:bg-navy-950 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
          Check Out
        </button>
      ) : !disabled ? (
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
          Check In
        </button>
      ) : null}
    </div>
  );
}
