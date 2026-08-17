// The other half of the walk-in lane: requests the host has now said yes to.
//
// Without this tab an approved walk-in had nowhere to go. CheckInPanel — the
// only other way into `checked_in` from the guard surface — moved to
// /guard/pre-approvals, and it searches pre-approvals, so a visitor who was
// never booked could be approved and then never checked in. This is their gate.
//
// A photo is taken here rather than at registration because at registration
// nobody knows yet whether the visitor is coming in: WalkInRequest deliberately
// inserts photo_path/photo_data as null. Capturing it at the moment of entry is
// also what the pre-approved lane does, so every checked-in visit carries a
// photo taken at the gate, however the visitor got approved.
//
// The ID scan and the visitor card number are UNCONDITIONAL here, exactly as on
// the pre-approved photo step (CheckInPhotoStep): a walk-in is the one arrival
// the guard has never seen a pass for, so reading the document at the gate is
// not optional polish, it is the identity check.
//
// The check-in rows themselves are PendingGateCheckIn, shared with the walk-in
// register (client instruction, 2026-08-17) — the same control on both screens,
// written once.
import React from 'react';
import type { Visit } from '../../types/index';
import VisitorCard from './VisitorCard';
import PendingGateCheckIn from './PendingGateCheckIn';
import { formatDateTime } from '../../lib/formatDate';
import { isAwaitingGateCheckIn } from '../../lib/visitOrigin';

// The shape moved to lib/checkInWalkInApproved.ts with the write it describes,
// so the form and the mutation cannot drift apart.
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  loading: boolean;
  /** Every walk-in the host cleared — those still at the gate AND those already
   *  admitted. The component splits them; only the first group is actionable. */
  approved: Visit[];
  busyId: string | null;
  onCheckIn: (visit: Visit, details: WalkInCheckIn) => void;
  /** Let an admitted walk-in leave. The parent opens the same
   *  `CardReturnConfirm` and calls the same `lib/checkOutFlow.logVisitExit` the
   *  Entry & Exit tab uses — this desk asks for the exit, it does not write it,
   *  so "did a human witness this?" and "did the card come back?" keep one
   *  answer each. Optional: without a handler the admitted rows stay read-only
   *  rather than growing a button that resolves to nothing. */
  onCheckOut?: (visit: Visit) => void;
};

export default function GuardWalkInApproved({ loading, approved, busyId, onCheckIn, onCheckOut }: Props): React.ReactElement {
  // The lane holds every walk-in the host cleared. Only a row still resting in
  // `walkin_approved` has anything left for this desk to do on the way IN, so
  // only that row gets a Check In button.
  //
  // An admitted row is not inert, though. It used to render read-only on the
  // reasoning that the visitor is through the gate and there is nothing left to
  // do — which was true of the ENTRY and forgot the exit. `checked_in` gets
  // Check Out; `checked_out` gets neither, since the one action left has
  // already happened.
  const waiting = approved.filter(isAwaitingGateCheckIn);
  const admitted = approved.filter((v) => !isAwaitingGateCheckIn(v));

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="gate-section-title">Approved walk-ins</h2>
        <span className="glass-chip !py-1 tabular-nums">{approved.length}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : approved.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">No walk-ins have been approved.</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
            Once a person to meet approves a walk-in they appear here, and stay here after they enter.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <PendingGateCheckIn waiting={waiting} busyId={busyId} onCheckIn={onCheckIn} />

          {/* Cleared AND already through the gate. They stay on this lane
              because "who did the host approve?" is not answered by a list that
              deletes people the moment they walk in — that is the complaint this
              section exists to answer. Read-only, and labelled, so the guard is
              never in doubt which rows still need them. */}
          {admitted.length > 0 && (
            <>
              <p className="gate-section-title !text-[11px] pt-3 pb-0.5">
                Already checked in ({admitted.length})
              </p>
              {admitted.map((v, i) => (
                <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                  <VisitorCard
                    visit={v}
                    timeLabel={formatDateTime(v.checked_in_at ?? v.created_at)}
                    action={onCheckOut && v.status === 'checked_in'
                      ? { label: 'Check Out', onClick: () => onCheckOut(v) }
                      : undefined}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
