// Pre-approval only. The "Pending" tab that used to live here has moved to the
// Overview, where the pending walk-in requests now render as full detail cards
// under the KPI tiles — an HOD opens the Overview to see what needs them, so
// making them navigate to a second page to act on it was a detour. This page is
// the one thing Overview cannot be: the form for inviting a visitor ahead of
// time. See pages/HOD/OverviewPendingApprovals.tsx for the decision surface.
//
// NO PAGE HEADER (client instruction, 2026-08-18). The "Pre-Approve" title and
// its "Invite a visitor before they arrive" subtitle are gone, along with the
// gradient icon plate beside them: the sidebar item the HOD just pressed says
// "Pre-Approvals", and the form below it opens with its own heading and its own
// fields. The same rule already holds on the HOD Overview and the guard
// dashboard — a page header that restates the nav item is a line of chrome
// between the user and the only control on the screen. Do not re-add one.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import PreApproveForm from './PreApproveForm';

export default function HODApprovals(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in space-y-6">
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
