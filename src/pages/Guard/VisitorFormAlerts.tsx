import React from 'react';

type ActiveVisitCheck = { checking: boolean; message: string | null };

type Props = {
  blacklistHit: string | null;
  recalledName: string | null;
  hasPreApprovedVisit: boolean;
  error: string;
  activeVisitCheck: ActiveVisitCheck;
  onDismissActiveVisitCheck: () => void;
};

export default function VisitorFormAlerts({
  blacklistHit, recalledName, hasPreApprovedVisit, error, activeVisitCheck, onDismissActiveVisitCheck,
}: Props): React.ReactElement {
  return (
    <>
      {blacklistHit && (
        <div className="rounded-xl border-2 border-danger-500/30 bg-danger-50 p-4 flex items-start gap-3 animate-fade-in">
          <div className="shrink-0 h-8 w-8 rounded-lg bg-danger-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
          <div>
            <p className="font-bold text-danger-700">BLACKLISTED — Do not allow entry</p>
            <p className="text-sm text-danger-600 mt-0.5">Reason: {blacklistHit}</p>
            <p className="text-xs text-danger-500 mt-1">Contact Admin or Security Head immediately.</p>
          </div>
        </div>
      )}

      {recalledName && !blacklistHit && !hasPreApprovedVisit && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Returning visitor — details pre-filled
        </div>
      )}

      {error && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {activeVisitCheck.message && (
        <div className="alert-warning">
          <svg className="w-4 h-4 text-warning-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{activeVisitCheck.message}</span>
          <button onClick={onDismissActiveVisitCheck} className="text-warning-500 hover:text-warning-700 text-xs font-medium ml-auto">Dismiss</button>
        </div>
      )}
    </>
  );
}
