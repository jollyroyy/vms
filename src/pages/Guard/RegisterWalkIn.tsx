import React, { useEffect, useState } from 'react';

import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import { TILE_FILTER } from '../../lib/guardTiles';
import { formatStamp } from '../../lib/formatDate';
import VisitorCard from './VisitorCard';
import WalkInRequest from './WalkInRequest';
import PendingGateCheckIn from './PendingGateCheckIn';
import SuccessToast from '../../components/SuccessToast';
import { isAwaitingGateCheckIn } from '../../lib/visitOrigin';
import { checkInApprovedWalkIn } from '../../lib/checkInWalkInApproved';
import type { Visit } from '../../types/index';

// "Register Walk-in" — its own left-hand nav item since 2026-08-15 (client
// instruction), at /guard/walk-in.
//
// It used to be a `+` button inside the Visitors tab's walk-in segment: the
// guard had to know that Visitors held a walk-in lane, reach it, and then find
// a plus sign that expanded into the form. Registering an unannounced arrival
// is one of the two ways a visitor gets into this building — it deserves a
// destination, not a disclosure triangle three clicks in.
//
// THE FORM IS OPEN ON ARRIVAL. There is no plus sign here at all: the page's
// entire subject is the form, so a control whose only job is to reveal it would
// be one press between the guard and the person standing in front of them.
//
// Two columns: the queue on the left, the form on the right. The pending list
// travels with the form because registering an arrival and watching for the
// host's answer is one continuous job — a guard bounces between them while a
// queue builds at the gate, which is why they were on one screen before and
// stay on one screen now.
//
// The left column is the walk-in's two waits, stacked in the order they happen:
// **Awaiting host approval**, then **Awaiting gate check-in** directly below it
// (client instruction, 2026-08-17). A row moves from the first box to the second
// the moment the host answers, so the guard reads one column downwards rather
// than hunting a second lane at the bottom of the page.
//
// The second box is the ONLY route from `walkin_approved` to `checked_in` on
// this page — CheckInPanel searches pre-approvals, so nothing else can let an
// approved walk-in through the gate. It renders PendingGateCheckIn, the same
// rows /visitors/approved renders, and the write is shared
// (lib/checkInWalkInApproved.ts), never re-hosted.
//
// It carries NO "already checked in" list (same instruction). A visitor who is
// through the gate is the Entry & Exit tab's subject — that page holds their
// entry time, their exit time and the only exit control — and listing them here
// as well put one visitor on two surfaces with nothing saying which was
// authoritative. Every row in this box has a Check In button under it, which is
// the guardTiles.ts rule: the count is the length of the list it opens.

export default function RegisterWalkIn(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const today = istDateKey(clock);
  const { visits, loading } = useTodayVisits(today);

  // The SAME predicate the dashboard's Pending Approval tile counts on, so the
  // number on the board and the list on this page cannot disagree.
  const pending = visits
    .filter((v) => TILE_FILTER.pending(v, clock))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // The SAME predicate the dashboard's Approved Walk-ins tile counts on,
  // narrowed to the ones still OUTSIDE: isAwaitingGateCheckIn is the half of
  // isApprovedWalkIn that answers "who is still standing at the gate?", so the
  // count on this box is the number of Check In buttons under it.
  const awaitingCheckIn = visits
    .filter((v) => TILE_FILTER.walkinApproved(v, clock) && isAwaitingGateCheckIn(v))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const letThemIn = async (visit: Visit, details: Parameters<typeof checkInApprovedWalkIn>[1]) => {
    setError(''); setBusyId(visit.id);
    const res = await checkInApprovedWalkIn(visit, details);
    setBusyId(null);
    if (!res.ok) { setError(res.message); return; }
    setToast(`"${res.visitorName}" checked in.`);
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <SuccessToast message={toast} onDismiss={() => setToast(null)} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left — the walk-in's two waits, in the order they happen. */}
        <div className="xl:col-span-5 space-y-5">
          <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-h2 text-navy-950 dark:text-white">Awaiting host approval</h2>
              {/* The count IS the length of the list beside it. */}
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
                  // formatStamp, not formatTime: this list is not date-bounded —
                  // a walk-in raised at 23:50 is still open at 00:05 — so a bare
                  // time would say when but not whether that when was today.
                  <VisitorCard key={v.id} visit={v} timeLabel={formatStamp(v.created_at, clock)} />
                ))}
              </div>
            )}
          </div>

          {/* Approved and still outside. The photo, the ID scan and the card
              number are captured HERE rather than at registration, because when
              a walk-in is raised nobody yet knows whether the host will say
              yes — and the card physically changes hands at this moment. */}
          <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-h2 text-navy-950 dark:text-white">Awaiting gate check-in</h2>
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
                <PendingGateCheckIn
                  waiting={awaitingCheckIn}
                  busyId={busyId}
                  onCheckIn={(v, details) => { void letThemIn(v, details); }}
                />
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-danger-500/30 bg-danger-600/10 px-4 py-3 text-sm text-danger-400">{error}</p>
          )}
        </div>

        {/* Right — the register itself, always open. */}
        <div className="xl:col-span-7">
          <WalkInRequest
            onSubmitted={(name) => {
              setToast(`Walk-in request raised for "${name}". The host has been asked to approve.`);
              setTimeout(() => setToast(null), 5000);
            }}
          />
        </div>
      </div>
    </div>
  );
}
