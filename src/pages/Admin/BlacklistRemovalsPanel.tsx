import React from 'react';
import DashboardPanel from '../../components/DashboardPanel';
import { ICON_CHECK_CIRCLE } from '../../lib/tileIcons';
import { formatDateTime } from '../../lib/formatDate';
import type { BlacklistRemovalRequest, BlacklistRemovalStatus } from '../../types/index';

type Props = {
  requests: BlacklistRemovalRequest[];
  loading: boolean;
  heading?: string;
  /** "Nothing filed yet" and "nothing decided yet" are different facts, and
   *  this panel serves both surfaces — the admin's history and the CEO's. One
   *  sentence for the two would be wrong on whichever screen it was not
   *  written for. */
  emptyMessage?: string;
};

// Where every removal request stands: who asked, why, and what the CEO said.
//
// IT EXISTS BECAUSE THE BLACKLIST PANEL ABOVE CANNOT ANSWER THIS. That table's
// membership rule is "flagged right now", so the moment the CEO approves a
// removal the visitor leaves it — and with them, every trace that anybody ever
// asked. An admin who filed a request on Monday would have no way to find out
// on Tuesday whether it was granted or refused, and a refusal in particular
// would be indistinguishable from a request that was never sent.
//
// PENDING ROWS ARE NOT PULLED TO THE TOP. The list is newest-first by filing
// date, full stop: this panel is the admin's record of what they asked for,
// and the row they are looking for is the one they filed most recently. The
// CEO's screen is the one that sorts by urgency, because it is a queue of work
// rather than a history.
//
// THE DECISION NOTE IS PRINTED IN FULL, never truncated to a cell width. On a
// refusal it is the entire answer — what the admin has to act on, and the only
// thing they can appeal — and half a sentence with an ellipsis is a worse
// record than no note at all.

const STATUS_STYLE: Record<BlacklistRemovalStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting CEO', className: 'bg-warning-500/15 text-warning-600 dark:text-warning-400' },
  approved: { label: 'Approved', className: 'bg-success-500/15 text-success-600 dark:text-success-400' },
  rejected: { label: 'Refused', className: 'bg-danger-500/15 text-danger-600 dark:text-danger-400' },
};

export default function BlacklistRemovalsPanel({
  requests,
  loading,
  heading = 'Blacklist Removal Requests',
  emptyMessage = 'No removal has been requested. Blacklisted visitors stay flagged until the CEO approves one.',
}: Props): React.ReactElement {
  return (
    <DashboardPanel
      icon={ICON_CHECK_CIRCLE}
      heading={heading}
      count={requests.length}
      loading={loading}
    >
      {!loading && requests.length === 0 && (
        <p className="text-sm text-navy-500 text-center py-8">{emptyMessage}</p>
      )}

      <ul className="space-y-3">
        {requests.map((r) => {
          const style = STATUS_STYLE[r.status];
          return (
            <li
              key={r.id}
              className="rounded-xl border border-surface-200/60 dark:border-white/[0.08]
                         bg-surface-100/50 dark:bg-white/[0.02] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-950 dark:text-white truncate">
                    {r.visitor?.full_name ?? 'Visitor record not found'}
                  </p>
                  <p className="text-xs text-navy-500 tabular-nums">{r.visitor?.phone ?? '—'}</p>
                </div>
                <span className={`status-badge whitespace-nowrap ${style.className}`}>{style.label}</span>
              </div>

              <p className="text-sm text-navy-800 mt-2 break-words">{r.justification}</p>

              <p className="text-xs text-navy-500 mt-2">
                Requested by {r.requester?.full_name ?? 'Not recorded'} · {formatDateTime(r.created_at)}
              </p>

              {r.status !== 'pending' && (
                <p className="text-xs text-navy-500 mt-0.5">
                  {style.label} by {r.decider?.full_name ?? 'Not recorded'}
                  {r.decided_at ? ` · ${formatDateTime(r.decided_at)}` : ''}
                </p>
              )}

              {r.decision_note && (
                <p className="text-sm text-navy-800 mt-2 break-words italic">"{r.decision_note}"</p>
              )}
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
