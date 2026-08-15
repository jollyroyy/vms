import React, { useEffect, useState } from 'react';

import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import { TILE_FILTER } from '../../lib/guardTiles';
import { formatStamp } from '../../lib/formatDate';
import VisitorCard from './VisitorCard';
import WalkInRequest from './WalkInRequest';
import GuardWalkInApproved from './GuardWalkInApproved';
import SuccessToast from '../../components/SuccessToast';
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
// It also carries the APPROVED walk-ins waiting to come in, below both. That
// lane used to be /visitors/approved, and it is the ONLY route from
// `walkin_approved` to `checked_in` — CheckInPanel searches pre-approvals, so
// nothing else can let an approved walk-in through the gate. When the Visitors
// tab left the sidebar on 2026-08-15 that route had to land somewhere, and this
// is the page that already owns the walk-in's whole life: raise it, watch for
// the host's answer, then take the photo and let them in. The write is shared
// with the old console route (lib/checkInWalkInApproved.ts), never re-hosted.

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

  // The SAME predicate the dashboard's Approved Walk-ins tile counts on.
  const approved = visits
    .filter((v) => TILE_FILTER.walkinApproved(v, clock))
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
        {/* Left — what is already waiting on a host. */}
        <div className="xl:col-span-5 rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-h2 text-navy-950 dark:text-white">Awaiting approval</h2>
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

      {error && (
        <p className="rounded-xl border border-danger-500/30 bg-danger-600/10 px-4 py-3 text-sm text-danger-400">{error}</p>
      )}

      {/* Approved and waiting to come in. It captures the photo here rather
          than at registration, because when a walk-in is raised nobody yet
          knows whether the host will say yes. */}
      <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
        <GuardWalkInApproved
          loading={loading}
          approved={approved}
          busyId={busyId}
          onCheckIn={(v, details) => { void letThemIn(v, details); }}
        />
      </div>
    </div>
  );
}
