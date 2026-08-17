// The rows a guard can still let IN: walk-ins the host cleared who are standing
// on the other side of the gate.
//
// A list, deliberately with no heading and no count of its own — it renders
// inside two different boxes (the Approved Walk-ins lane and the walk-in
// register's "Pending gate check-in" panel) and each states its own heading.
// Duplicating the count here would put the same number twice on one screen.
//
// The open row is held HERE rather than inside each row, so exactly one
// check-in is in progress at a time. It began as the ONE CAMERA AT A TIME rule
// (the form used to mount a webcam; since 2026-08-17 it asks only for the card
// number), and it still stands on its own: a guard hands over one physical card
// to one visitor, and two card fields open side by side is how the wrong number
// lands on the wrong row.
import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorCard from './VisitorCard';
import WalkInCheckInForm from './WalkInCheckInForm';
import { formatDateTime } from '../../lib/formatDate';
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  /** Walk-ins resting in `walkin_approved` — cleared, not yet admitted. */
  waiting: Visit[];
  busyId: string | null;
  onCheckIn: (visit: Visit, details: WalkInCheckIn) => void;
};

export default function PendingGateCheckIn({ waiting, busyId, onCheckIn }: Props): React.ReactElement {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {waiting.map((v, i) => (
        <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
          <VisitorCard
            visit={v}
            timeLabel={formatDateTime(v.created_at)}
            action={openId === v.id ? undefined : { label: 'Check In', onClick: () => setOpenId(v.id) }}
          />

          {openId === v.id && (
            <WalkInCheckInForm
              key={v.id}
              visit={v}
              busy={busyId === v.id}
              onCancel={() => setOpenId(null)}
              onConfirm={(details) => { onCheckIn(v, details); setOpenId(null); }}
            />
          )}
        </div>
      ))}
    </>
  );
}
