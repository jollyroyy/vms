// The pre-booked arrival desk. CheckInPanel moved here from the visitor console
// (pages/Guard/Console.tsx): the QR gate and the match search both only ever
// resolve a visitor who was booked in advance, which is exactly the population
// this page already lists. Scanning a pass and then finding that person's row
// is one job, so it is now one screen.
import React, { useCallback, useState } from 'react';
import { usePreApprovals } from '../../lib/usePreApprovals';
import PreApprovalRow from './PreApprovalRow';
import CheckInPanel from './CheckInPanel';

// Today only. The Upcoming and All filters are gone from the guard surface: a
// guard can only check in a visitor who is due today, so a list of next week's
// bookings was a list of rows nothing could be done with — and one the guard
// could mistake for an arrival that is actually due. The hook still supports
// the other filters for callers that legitimately need history (Reports).
export default function GuardPreApprovals(): React.ReactElement {
  const { visits, loading } = usePreApprovals('today');
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
        <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">Scan a pass or find a booked visitor to check them in.</p>
      </div>

      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <CheckInPanel today={today} onCheckInSuccess={onCheckInSuccess} />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
          </div>
        ) : visits.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <p className="text-sm font-semibold text-navy-500">No pre-approvals scheduled for today.</p>
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
