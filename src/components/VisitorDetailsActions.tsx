// A pre-approval is FINAL. Approve/Reject are the only decisions this popup
// offers, and they exist only while the visit is still pending — once an HOD
// has approved, there is no un-approving it from any surface. Do not re-add a
// "Cancel Pre-Approval" branch here (see the note in useVisitDecisions.ts).
import React, { useState } from 'react';
import type { Visit } from '../types/index';

type Props = {
  visit: Visit;
  busy: boolean;
  reason: string;
  onReasonChange?: (value: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
};

export default function VisitorDetailsActions({
  visit, busy, reason, onReasonChange, onApprove, onReject,
}: Props): React.ReactElement | null {
  const [confirmingReject, setConfirmingReject] = useState(false);

  const isPending = visit.status === 'pending_approval';

  if (isPending && (onApprove || onReject)) {
    return (
      <div className="px-5 pb-5">
        {confirmingReject ? (
          <div className="rounded-2xl border border-danger-200 dark:border-danger-500/20 bg-danger-50/60 dark:bg-danger-500/10 p-4 space-y-3 animate-fade-in">
            <p className="text-[11px] font-bold text-danger-700 dark:text-danger-400 uppercase tracking-wide">Rejection reason</p>
            <input
              autoFocus
              type="text"
              maxLength={500}
              placeholder="Why is this visit being rejected?"
              value={reason}
              onChange={(e) => onReasonChange?.(e.target.value)}
              className="input"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmingReject(false)}
                className="flex-1 rounded-xl border border-surface-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-navy-500 py-2.5 text-sm font-semibold hover:bg-surface-50 dark:hover:bg-white/[0.08] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { onReject?.(); setConfirmingReject(false); }}
                disabled={busy || !reason.trim()}
                className="flex-1 rounded-xl bg-danger-600 hover:bg-danger-700 text-white py-2.5 text-sm font-bold shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onApprove}
              disabled={busy}
              className="flex-1 rounded-xl bg-gradient-to-r from-success-500 to-emerald-600 hover:from-success-600 hover:to-emerald-700 text-white py-3 text-sm font-bold shadow-glow-sm disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Approve
            </button>
            <button
              onClick={() => setConfirmingReject(true)}
              disabled={busy}
              className="flex-1 rounded-xl border-2 border-danger-500/30 bg-danger-50/60 dark:bg-danger-500/10 text-danger-700 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-500/20 py-3 text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
