// The one place an HOD clears or refuses a visitor.
//
// It used to be `.hod-decision-card` in styles/hod-compact.css — a 10px-body,
// 8px-label panel in a navy palette of its own, which is what made the HOD
// surface read as a different application from the guard's (client
// instruction, 2026-08-16). It is now the same card, the same type scale and
// the same `.btn-primary` / `.btn-secondary` / `.input` the rest of /vms uses.
//
// Nothing about the DECISION changed with the styling: the reason box is still
// beside both actions, since `visits.rejection_reason` is the only place a
// decline's justification is written down and Reports prints it.
import React from 'react';
import type { Visit } from '../../types/index';
import { hostName, purposeLabel, visitTime, visitorCompany, visitorName } from '../../lib/hodVisitLabels';

type Props = {
  visit: Visit | null;
  reason: string;
  onReasonChange: (value: string) => void;
  acting: boolean;
  onDecide: (approved: boolean) => void;
};

function Fact({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-navy-500 dark:text-navy-400 font-semibold">{label}</p>
      <p className="text-sm text-navy-800 dark:text-navy-800 mt-0.5">{value}</p>
    </div>
  );
}

export default function HodDecisionPanel({
  visit, reason, onReasonChange, acting, onDecide,
}: Props): React.ReactElement {
  return (
    <aside className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm self-start">
      <p className="text-[11px] uppercase tracking-wider text-navy-500 dark:text-navy-400 font-semibold mb-3">
        Walk-in clearance
      </p>

      {!visit ? (
        <p className="text-sm text-[#9aa3af] dark:text-[#b7c0cb]">
          No request is awaiting your decision.
        </p>
      ) : (
        <>
          <h2 className="font-display text-h2 text-navy-950 dark:text-white leading-tight">{visitorName(visit)}</h2>
          <p className="text-sm text-[#9aa3af] dark:text-[#b7c0cb] mt-1">
            {visitorCompany(visit)} · arrived at reception {visitTime(visit)}
          </p>

          <div className="grid gap-3 mt-4 pt-4 border-t border-surface-200/60 dark:border-white/[0.07]">
            <Fact label="Host" value={hostName(visit)} />
            <Fact label="Purpose" value={purposeLabel(visit)} />
            {/* The guard's note from the register — a walk-in is the one visit an
                HOD decides blind, so whatever reception wrote down is the only
                context beyond a name and a purpose. */}
            <Fact label="Reception note" value={visit.remarks || 'No note was recorded at reception.'} />
          </div>

          <label className="block mt-4">
            <span className="label">Rejection reason <em className="not-italic text-warning-500">required to decline</em></span>
            <input
              className="input"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="State the reason if declining"
            />
          </label>

          <p className="text-xs text-[#9aa3af] dark:text-[#b7c0cb] mt-3 leading-relaxed">
            Your decision is final. Clearing entry creates the visitor’s active approval,
            which the gate then acts on.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button type="button" className="btn-secondary" onClick={() => onDecide(false)} disabled={acting}>
              Decline entry
            </button>
            <button type="button" className="btn-primary" onClick={() => onDecide(true)} disabled={acting}>
              {acting ? 'Saving…' : 'Clear entry'}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
