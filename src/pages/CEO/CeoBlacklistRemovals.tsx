import React, { useMemo } from 'react';
import CeoDecisionCard from './CeoDecisionCard';
import BlacklistRemovalsPanel from '../Admin/BlacklistRemovalsPanel';
import { useBlacklistRemovals, pendingRemovals, decidedRemovals } from '../../lib/useBlacklistRemovals';
import { decideBlacklistRemoval } from '../../lib/blacklistRemoval';

// The CEO's whole surface: the removal requests waiting on them, and what they
// have already decided.
//
// THIS ROLE HAS ONE SCREEN AND THAT IS DELIBERATE (migrations 090-092, client
// instruction 2026-08-17). The CEO is not a super-admin — they inherit no console, no
// visitor log and no settings. They exist for one decision: a visitor comes
// off the blacklist only when an admin has justified it and the CEO has
// granted it. A role whose authority is one flag should not be handed a
// building's worth of screens it has no reason to read.
//
// THE QUEUE IS OLDEST FIRST. It is work, not a history: the request that has
// been waiting longest is the one somebody is chasing, and a newest-first
// queue quietly buries it. The DECIDED list below it is the opposite —
// newest-first, because it is looked at to check what just happened.
//
// PENDING AND DECIDED ARE TWO LISTS, NOT ONE WITH A BADGE. Only one of them
// can be acted on, and interleaving them means scanning past decisions to find
// the decision still to make. Each carries its own empty state, because "you
// are up to date" and "you have never decided one of these" are different
// facts and would otherwise be the same sentence.
//
// IT WRITES THROUGH `decideBlacklistRemoval` AND NOTHING ELSE. The RPC clears
// `visitors.is_blacklisted` in the same statement as the decision, so a
// granted approval and an unflagged visitor cannot come apart — there is no
// window in which the request reads "approved" while the visitor is still
// being turned away at the gate.

export default function CeoBlacklistRemovals(): React.ReactElement {
  const { requests, loading, error } = useBlacklistRemovals();

  const pending = useMemo(() => pendingRemovals(requests), [requests]);
  const decided = useMemo(() => decidedRemovals(requests), [requests]);

  // No local optimistic state: the hook is subscribed to `postgres_changes`,
  // so the decided row arrives the same way it would for the admin watching
  // the other end of it. One source, one answer.
  const decide = async (id: string, approve: boolean, note: string) => {
    await decideBlacklistRemoval(id, approve, note);
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* No page heading — the sidebar item just clicked already says it, the
          same call the guard and admin dashboards make. The line below is not
          a restatement of the name: it says what pressing Approve does. */}
      <p className="text-sm text-navy-700 mb-5 max-w-2xl">
        An admin has asked for a visitor to be taken off the blacklist. Until you approve it, the
        visitor stays flagged and the gate keeps refusing them entry.
      </p>

      {error && (
        <p className="text-sm text-danger-600 mb-4">
          The queue could not be loaded: {error}
        </p>
      )}

      <h2 className="font-display text-h2 text-navy-950 dark:text-white mb-3">
        Waiting on you{pending.length > 0 ? ` (${pending.length})` : ''}
      </h2>

      {loading && <p className="text-sm text-navy-500 py-8 text-center">Loading…</p>}

      {!loading && pending.length === 0 && (
        <p className="text-sm text-navy-500 py-8 text-center rounded-2xl bg-surface-100/60
                      dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07]">
          Nothing is waiting on you. No admin has asked for a blacklist removal.
        </p>
      )}

      <ul className="space-y-4">
        {pending.map((r) => (
          <CeoDecisionCard
            key={r.id}
            request={r}
            onDecide={(approve, note) => decide(r.id, approve, note)}
          />
        ))}
      </ul>

      <div className="mt-8">
        <BlacklistRemovalsPanel
          requests={decided}
          loading={loading}
          heading="Already Decided"
          emptyMessage="You have not decided a removal request yet."
        />
      </div>
    </div>
  );
}
