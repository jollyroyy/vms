import React, { useState } from 'react';

import type { ReportVisit } from '../../lib/reportRow';
import { DENY_REASON_MIN } from '../../lib/denyEntryFlow';

// The gate between pressing Deny Entry and the refusal being recorded.
//
// THE JUSTIFICATION IS MANDATORY (client instruction, 2026-08-15). "Refuse
// entry" stays disabled until a reason is typed — it is not a warning the guard
// can click past, it is the only route to the write. The reason is stored on
// `visits.rejection_reason` and printed in Reports beside the guard's name,
// because refusing a person who was already approved is the most consequential
// thing a guard can record about somebody, and an unexplained refusal in a
// register is worse than no register at all.
//
// Premium in the same language as the rest of the app rather than a new one:
// `card-premium` surface, a danger medallion, the app's own `input`/`label`
// classes, and a live counter that says exactly what is still needed. No
// `dark:text-navy-*` anywhere — the navy scale is INVERTED in dark mode (see
// CLAUDE.md), and this dialog must be legible in both themes.

type DenyEntryConfirmProps = {
  visit: ReportVisit;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  busy?: boolean;
};

export default function DenyEntryConfirm({ visit, onConfirm, onClose, busy }: DenyEntryConfirmProps): React.ReactElement {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const short = Math.max(0, DENY_REASON_MIN - trimmed.length);
  const ready = short === 0 && !busy;
  const name = visit.visitor?.full_name ?? 'This visitor';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deny-title">
      <div className="card-premium w-full max-w-md p-6 sm:p-7">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-danger-500 to-danger-600 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 id="deny-title" className="font-display text-h2 text-navy-950 dark:text-white leading-tight">
              Refuse entry?
            </h2>
            <p className="mt-1.5 text-sm text-navy-800 break-words">
              <span className="font-semibold">{name}</span> was already approved to visit.
              Refusing voids that pass — they will not be able to check in.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="deny-reason">
            Reason for refusing entry <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="deny-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            aria-describedby="deny-reason-help"
            placeholder="e.g. no photo ID produced; name does not match the pass; host declined on the phone"
            className="input w-full resize-none"
          />
          <div id="deny-reason-help" className="mt-1.5 flex items-start justify-between gap-3">
            <p className={`text-xs ${short > 0 ? 'text-warning-500 font-medium' : 'text-navy-700'}`}>
              {short > 0
                ? 'A reason is required before you can refuse entry.'
                : 'Stored on the visit and shown in Reports, alongside your name.'}
            </p>
            <span className="text-xs tabular-nums text-navy-700 shrink-0">{trimmed.length}/500</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-surface-200/60 dark:border-white/[0.12] text-navy-800 hover:bg-surface-100/70 dark:hover:bg-white/[0.05] font-semibold text-sm px-4 py-2.5 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={!ready}
            title={ready ? undefined : 'Enter a reason first'}
            className="flex-1 rounded-xl bg-danger-600 hover:bg-danger-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2.5 transition-colors shadow-glow-sm">
            {busy ? 'Recording…' : 'Refuse entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
