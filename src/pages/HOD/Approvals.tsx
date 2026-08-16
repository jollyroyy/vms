// Pre-approval only. The "Pending" tab that used to live here has moved to the
// Overview, where the pending walk-in requests now render as full detail cards
// under the KPI tiles — an HOD opens the Overview to see what needs them, so
// making them navigate to a second page to act on it was a detour. This page is
// the one thing Overview cannot be: the form for inviting a visitor ahead of
// time. See pages/HOD/OverviewPendingApprovals.tsx for the decision surface.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import PreApproveForm from './PreApproveForm';

export default function HODApprovals(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="page-title">Pre-Approve</h1>
          <p className="page-subtitle">Invite a visitor before they arrive</p>
        </div>
      </div>

      {/* The form already shows one green success popup. Dismissing it hands
          off straight to the pre-approved list rather than raising a second
          banner here, so there is exactly one success confirmation. */}
      {/* Hands off to the Visitor Schedule, which lists approved and expected
          visits — the pass just raised is the top row of it. `?filter=approved`
          was a param nothing on the console reads, so it landed on a bare
          Overview and the HOD had no confirmation their booking existed. */}
      <PreApproveForm onPreApproved={() => navigate('/overview?tab=schedule')} />
    </div>
  );
}
