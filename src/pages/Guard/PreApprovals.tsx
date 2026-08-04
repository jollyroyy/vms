// The pre-booked arrival desk. CheckInPanel moved here from the visitor console
// (pages/Guard/Console.tsx): the QR gate and the match search both only ever
// resolve a visitor who was booked in advance, which is exactly the population
// this page already lists. Scanning a pass and then finding that person's row
// is one job, so it is now one screen.
import React, { useCallback, useState } from 'react';
import { usePreApprovals, type PreApprovalFilter } from '../../lib/usePreApprovals';
import PreApprovalRow from './PreApprovalRow';
import CheckInPanel from './CheckInPanel';

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
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg, setSuccessMsg] = useState('');

  const onCheckInSuccess = useCallback((name: string) => {
    setSuccessMsg(`"${name}" checked in successfully.`);
    setTimeout(() => setSuccessMsg(''), 6000);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-950 dark:text-white">Pre-Approvals</h1>
        <p className="text-sm text-navy-400 mt-0.5">Scan a pass or find a booked visitor to check them in.</p>
      </div>

      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <CheckInPanel today={today} onCheckInSuccess={onCheckInSuccess} />

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
