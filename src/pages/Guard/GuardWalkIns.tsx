import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorCard from './VisitorCard';
import WalkInRequest from './WalkInRequest';
import PendingGateCheckIn from './PendingGateCheckIn';
import { formatTime } from '../../lib/formatDate';
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  loading: boolean;
  /** Today's walk-ins still waiting on an HOD decision. */
  pending: Visit[];
  /** Walk-ins the host has cleared who have not walked through the gate yet.
   *  Actionable HERE (client instruction, 2026-08-17): the guard who raised the
   *  request is the one standing in front of the visitor when the answer comes
   *  back, and the only Check In button used to be on a different tab. */
  awaitingCheckIn: Visit[];
  busyId: string | null;
  onCheckIn: (visit: Visit, details: WalkInCheckIn) => void;
  onSubmitted: (name: string) => void;
};

// The walk-in lane: someone turned up unannounced. Three things happen here,
// and they are the three stages of that visitor's life at this desk, in order —
// you register the arrival, you wait for the person to meet to decide, and you
// let the cleared visitor in.
//
// THE TWO WAITS ARE STACKED IN THAT ORDER: **Awaiting host approval**, then
// **Awaiting gate check-in** directly below it (client instruction,
// 2026-08-17). Both headings are the client's words. "Awaiting approval" left
// unsaid WHOSE — this desk waits on two different people in sequence — and a row
// crossing from one wait to the other now moves one box down rather than jumping
// the page. This is the same column /guard/walk-in (RegisterWalkIn) reads, so a
// guard learns the sequence once.
export default function GuardWalkIns(
  { loading, pending, awaitingCheckIn, busyId, onCheckIn, onSubmitted }: Props,
): React.ReactElement {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-4">
      {formOpen ? (
        <WalkInRequest
          onSubmitted={(name) => { setFormOpen(false); onSubmitted(name); }}
          onCancel={() => setFormOpen(false)}
        />
      ) : (
        <button type="button" onClick={() => setFormOpen(true)}
          className="gate-tile w-full flex items-center gap-3.5">
          <span className="h-12 w-12 rounded-xl bg-brand-500/15 text-brand-700 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[15px] font-bold text-navy-950">Register a walk-in</span>
            <span className="block text-xs text-navy-500 dark:text-navy-400 mt-0.5">
              Capture details and send the person to meet an approval request
            </span>
          </span>
        </button>
      )}

      {/* Wait one: the host has not answered yet. Watch-only — nothing here can
          be acted on until somebody else decides. */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="gate-section-title">Awaiting host approval</h2>
          <span className="glass-chip !py-1 tabular-nums">{pending.length}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="card empty-state !py-12">
            <p className="text-sm font-semibold text-navy-500">Nothing waiting on a person to meet.</p>
            <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
              Walk-ins you register will appear here until the person to meet responds.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((v) => (
              <VisitorCard key={v.id} visit={v} timeLabel={formatTime(v.created_at)} />
            ))}
          </div>
        )}
      </div>

      {/* Wait two: the host said yes and the visitor is still outside. Every row
          in this box has a Check In button under it — the guardTiles.ts rule,
          the count being the length of the list it opens. Nobody already through
          the gate is listed: that visitor is the Entry & Exit tab's subject,
          which holds their entry time, their exit time and the only exit
          control. */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="gate-section-title">Awaiting gate check-in</h2>
          <span className="glass-chip !py-1 tabular-nums">{awaitingCheckIn.length}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
          </div>
        ) : awaitingCheckIn.length === 0 ? (
          <div className="card empty-state !py-12">
            <p className="text-sm font-semibold text-navy-500">Nobody is waiting to be checked in.</p>
            <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
              Once the person to meet approves a walk-in they appear here with a Check In button.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <PendingGateCheckIn waiting={awaitingCheckIn} busyId={busyId} onCheckIn={onCheckIn} />
          </div>
        )}
      </div>
    </div>
  );
}
