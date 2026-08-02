import React, { useState } from 'react';
import { usePreApprovals, type PreApprovalFilter } from '../../lib/usePreApprovals';
import PreApprovalRow from './PreApprovalRow';

const FILTER_OPTIONS: PreApprovalFilter[] = ['today', 'upcoming', 'all'];

const FILTER_LABELS: Record<PreApprovalFilter, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  all: 'All',
};

const EMPTY_MESSAGES: Record<PreApprovalFilter, string> = {
  today: 'No pre-approvals scheduled for today.',
  upcoming: 'No upcoming pre-approvals scheduled.',
  all: 'No pre-approvals on record.',
};

export default function GuardPreApprovals(): React.ReactElement {
  const [filter, setFilter] = useState<PreApprovalFilter>('today');
  const { visits, loading } = usePreApprovals(filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-950 dark:text-white">Pre-Approvals</h1>
        <p className="text-sm text-navy-400 mt-0.5">Visitors booked to arrive, including future dates.</p>
      </div>

      <div className="inline-flex rounded-xl bg-surface-100 dark:bg-white/[0.06] p-1 gap-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setFilter(opt)}
            className={
              opt === filter
                ? 'tab-active px-3 py-1.5 rounded-lg text-xs font-bold'
                : 'tab-inactive px-3 py-1.5 rounded-lg text-xs font-bold'
            }
          >
            {FILTER_LABELS[opt]}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
          </div>
        ) : visits.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">{EMPTY_MESSAGES[filter]}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-white/[0.05]">
            {visits.map((v) => <PreApprovalRow key={v.id} visit={v} />)}
          </div>
        )}
      </div>
    </div>
  );
}
