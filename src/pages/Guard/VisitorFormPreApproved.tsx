import React from 'react';

type PreApprovedVisit = {
  id: string;
  ref_number: string;
  visitor_name: string;
  dept_name: string;
  purpose: string;
  photo_data: string | null;
};

type Props = {
  preApprovedVisit: PreApprovedVisit;
  checkingInPreApproved: boolean;
  onCheckIn: () => void;
  onRegisterWalkIn: () => void;
};

export default function VisitorFormPreApproved({
  preApprovedVisit, checkingInPreApproved, onCheckIn, onRegisterWalkIn,
}: Props): React.ReactElement {
  // `to-white` is a literal white and does NOT flip, so without the dark:
  // override this card faded into a white slab on the dark theme.
  return (
    <div className="rounded-xl border-2 border-success-400/40 bg-gradient-to-br from-success-50 to-white dark:to-white/[0.04] p-5 space-y-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-xl bg-success-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="flex-1">
          <p className="font-bold text-success-800 dark:text-success-700 text-lg">Pre-Approved Visitor</p>
          <p className="text-sm text-success-700 mt-0.5">This visitor is pre-approved and ready for check-in.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-white/60 dark:bg-white/[0.06] rounded-xl p-4">
        <div><span className="font-semibold text-navy-700">Name:</span> <span className="text-navy-600">{preApprovedVisit.visitor_name}</span></div>
        <div><span className="font-semibold text-navy-700">Ref:</span> <span className="text-navy-600 font-mono">{preApprovedVisit.ref_number}</span></div>
        <div><span className="font-semibold text-navy-700">Department:</span> <span className="text-navy-600">{preApprovedVisit.dept_name}</span></div>
        <div><span className="font-semibold text-navy-700">Purpose:</span> <span className="text-navy-600 capitalize">{preApprovedVisit.purpose}</span></div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCheckIn} disabled={checkingInPreApproved}
          className="flex-1 bg-gradient-to-r from-success-600 to-success-700 text-white rounded-xl px-5 py-3 text-sm font-bold hover:from-success-700 hover:to-success-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-soft hover:shadow-glow transition-all duration-200 flex items-center justify-center gap-2">
          {checkingInPreApproved ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Check In Now
            </>
          )}
        </button>
        <button onClick={onRegisterWalkIn} disabled={checkingInPreApproved}
          className="btn-secondary text-sm px-5 py-3">
          Register as Walk-in
        </button>
      </div>
    </div>
  );
}
