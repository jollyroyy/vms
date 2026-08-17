// The other half of the walk-in lane: requests the host has now said yes to.
//
// Without this tab an approved walk-in had nowhere to go. CheckInPanel — the
// only other way into `checked_in` from the guard surface — moved to
// /guard/pre-approvals, and it searches pre-approvals, so a visitor who was
// never booked could be approved and then never checked in. This is their gate.
//
// THE PHOTO AND THE ID SCAN ARE NOT ASKED FOR AGAIN (client instruction,
// 2026-08-17). A walk-in cannot even be sent for approval without both —
// WalkInRequest blocks submit until they exist and uploads the photo before the
// visit row is inserted — so the identity record is complete before the host
// ever sees the request, and repeating it at the gate photographed the same
// person twice for one visit. WalkInCheckInForm shows what is already on file
// and asks only for the visitor card number, which is the one thing the gate
// alone knows (migration 076 demands it back at check-out).
//
// This is why /guard/pre-approvals is different: THAT visitor's document has
// never been read by this system, so CheckInPhotoStep's scan stays mandatory.
//
// The check-in rows themselves are PendingGateCheckIn, shared with the walk-in
// register (client instruction, 2026-08-17) — the same control on both screens,
// written once.
//
// IT LISTS NOBODY WHO IS ALREADY THROUGH THE GATE, and it carries no exit
// (client instruction, 2026-08-17). The heading is **Awaiting gate check-in**,
// the same words the register uses, and every row under it has a Check In button
// — the guardTiles.ts rule, the count being the length of the list it opens. The
// "Already checked in (N)" section that used to sit below, and the Check Out it
// carried, are gone: an admitted visitor is the Entry & Exit tab's subject, which
// holds their entry time, their exit time and the one exit control. That is the
// same one-visitor-on-two-surfaces reasoning that took Checked Out off the
// Visitors segments. Do not re-add an exit here — lib/checkOutFlow.logVisitExit
// has exactly one caller again.
import React from 'react';
import type { Visit } from '../../types/index';
import PendingGateCheckIn from './PendingGateCheckIn';
import { isAwaitingGateCheckIn } from '../../lib/visitOrigin';

// The shape moved to lib/checkInWalkInApproved.ts with the write it describes,
// so the form and the mutation cannot drift apart.
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  loading: boolean;
  /** Every walk-in the host cleared. The component narrows to the ones still at
   *  the gate — the only rows this desk can act on. */
  approved: Visit[];
  busyId: string | null;
  onCheckIn: (visit: Visit, details: WalkInCheckIn) => void;
};

export default function GuardWalkInApproved({ loading, approved, busyId, onCheckIn }: Props): React.ReactElement {
  // isAwaitingGateCheckIn is the NARROW half of isApprovedWalkIn: cleared by the
  // host AND still outside. Filtering here rather than in the parent keeps the
  // heading's count and the list underneath it derived from one predicate.
  const waiting = approved.filter(isAwaitingGateCheckIn);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="gate-section-title">Awaiting gate check-in</h2>
        <span className="glass-chip !py-1 tabular-nums">{waiting.length}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : waiting.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">Nobody is waiting to be checked in.</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
            Once the person to meet approves a walk-in they appear here with a Check In button.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <PendingGateCheckIn waiting={waiting} busyId={busyId} onCheckIn={onCheckIn} />
        </div>
      )}
    </div>
  );
}
