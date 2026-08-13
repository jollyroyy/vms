import React from 'react';
import { formatDateTime } from '../lib/formatDate';
import type { ReportVisit } from '../lib/reportRow';

// The timeline spine entry shared by VisitorDetails' audit strip. Extracted
// (2026-08-11) to keep VisitorDetails.tsx under the 300-line limit; nothing
// else uses it.
type Props = {
  color: string;
  label: string;
  time: string;
  highlight?: boolean;
  strong?: boolean;
};

export default function TimelineEntry({ color, label, time, highlight, strong }: Props): React.ReactElement {
  return (
    <div className="flex items-start gap-3 relative">
      {/* The ring separates the dot from the timeline spine behind it, so it
          has to match the panel, not be white — `navy-50` is the darkest end
          of the flipped scale and reads as the panel in dark mode. */}
      <div className={`w-[11px] h-[11px] rounded-full ${color} border-2 border-white dark:border-navy-50 shrink-0 mt-0.5 z-10`} />
      <div className={`flex-1 flex justify-between items-baseline gap-2 min-w-0 ${highlight ? 'text-danger-600 font-bold' : ''}`}>
        <span className="text-micro uppercase text-navy-500 shrink-0">{label}</span>
        <span className={`truncate tabular-nums ${strong ? 'text-body-lg font-bold' : 'text-body font-semibold'} ${highlight ? 'text-danger-600' : 'text-navy-800'}`}>{time}</span>
      </div>
    </div>
  );
}

type CardProps = {
  visit: ReportVisit;
  /** Resolved through lib/visitApproval — there is no visits.approved_at. */
  approvedAt: string | null;
  duration: { text: string; isOvertime: boolean };
  /** Draw the timestamps. False for a guard (client instruction, 2026-08-13):
   *  a guard is confirming who is in front of them, not auditing when the visit
   *  moved between states. The rejection reason is NOT gated by this — it is
   *  not a timestamp, it is WHY the visit is in the state it is in, and it is
   *  the one thing a guard reading a declined row at the gate must see. */
  showTimestamps: boolean;
};

/** The audit strip under the details grid. Renders nothing at all when there
 *  is neither a timestamp to show nor a reason to explain, so a guard's popup
 *  does not end on an empty card. */
export function VisitorTimelineCard({
  visit: v, approvedAt, duration, showTimestamps,
}: CardProps): React.ReactElement | null {
  if (!showTimestamps && !v.rejection_reason) return null;

  return (
    <div className="mx-5 mt-1 mb-5 rounded-xl bg-surface-50 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.06] p-4">
      {showTimestamps && (
        <p className="text-[10px] font-bold text-navy-500 dark:text-navy-400 uppercase tracking-wider mb-3">Timeline</p>
      )}
      <div className="space-y-3 relative">
        {showTimestamps && <div className="absolute left-[5px] top-2 bottom-2 w-px bg-surface-200 dark:bg-white/10" />}

        {showTimestamps && (
          <>
            {approvedAt && <TimelineEntry color="bg-success-400" label="Approved" time={formatDateTime(approvedAt)} />}
            {v.checked_in_at && <TimelineEntry color="bg-brand-500" label="Checked In" time={formatDateTime(v.checked_in_at)} />}
            {v.checked_out_at && <TimelineEntry color="bg-success-500" label="Checked Out" time={formatDateTime(v.checked_out_at)} />}
            {v.checked_in_at && v.status === 'checked_in' && (
              <TimelineEntry
                color={duration.isOvertime ? 'bg-danger-500' : 'bg-brand-400'}
                label="Duration"
                time={`${duration.text}${duration.isOvertime ? ' — Overtime' : ''}`}
                highlight={duration.isOvertime}
                strong
              />
            )}
          </>
        )}

        {v.rejection_reason && (
          <div className="flex items-start gap-3 relative">
            <div className="w-[11px] h-[11px] rounded-full bg-danger-500 border-2 border-white dark:border-navy-50 shrink-0 mt-0.5 z-10" />
            <div className="flex-1 min-w-0">
              <span className="text-micro normal-case text-danger-500 font-medium block">Rejection Reason</span>
              <span className="text-caption text-danger-700 font-medium">{v.rejection_reason}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}