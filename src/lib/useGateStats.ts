import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { isOverstaying } from './visitExpiry';
import type { VisitStatus } from '../types/index';

// Today's gate numbers, in the shape the guard dashboard reads them.
//
// The important subtlety is `entered` vs `inside`. `visits.status` holds ONE
// value, so a visitor who arrived at 09:00 and left at 11:00 is `checked_out`,
// not `checked_in`. Counting `status === 'checked_in'` therefore answers "who
// is still here", NOT "how many came through the gate today" — those are two
// different questions and a wireframe that shows both as separate tiles while
// deriving them from the same filter renders the same number twice.
//
// So `entered` is derived from `checked_in_at IS NOT NULL` (cumulative: anyone
// who ever passed the gate today) while `inside` stays status-derived (live).
// That gives a self-checking invariant the guard can eyeball:
//
//     entered === inside + checkedOut
//
// If those ever stop reconciling, the data is wrong — which is worth surfacing.
//
// There is deliberately NO `preApproved` / `walkInApproved` here (2026-08-13).
// Both counts moved off the dashboard entirely: they are segments of the
// Visitors surface, counted there from that page's own array. Keeping a second
// copy on this hook would put the same number on two screens behind two
// independent queries, with nothing forcing them to agree. `overdue` still
// spans both statuses — see IS_EXPECTED below.
export type GateStats = {
  entered: number;     // cumulative — everyone who checked in today
  inside: number;      // live — still on the premises
  checkedOut: number;  // came and left
  declined: number;    // HOD rejected the request (usually before arrival)
  noShow: number;      // pre-approval's scheduled moment passed, nobody arrived (nightly sweep)
  // Queue counts — what still needs a human to do something
  awaitingApproval: number; // raised at the gate, waiting on an HOD decision
  overdue: number;          // approved, scheduled arrival already passed
  overstaying: number;      // checked in, still inside well past any plausible visit
};

const EMPTY: GateStats = {
  entered: 0, inside: 0, checkedOut: 0, declined: 0,
  noShow: 0, awaitingApproval: 0, overdue: 0, overstaying: 0,
};

type Row = {
  id: string;
  status: VisitStatus;
  checked_in_at: string | null;
  scheduled_for: string | null;
};

// Which statuses count as "still expected at the gate". A pre-approval is
// INSERTed already `approved`; a walk-in becomes `walkin_approved` when the HOD
// says yes. Lookup map rather than an includes() chain, per CLAUDE.md.
//
// `overdue` MUST keep covering BOTH statuses — a visitor is overdue whichever
// route got them approved, so do not narrow this to one status.
const IS_EXPECTED: Record<string, boolean> = {
  approved: true,
  walkin_approved: true,
};

export function useGateStats(today: string): { stats: GateStats; loading: boolean } {
  const [stats, setStats] = useState<GateStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const start = `${today}T00:00:00Z`;
    const end = `${today}T23:59:59Z`;
    // Not just created_at: a pre-approval raised last week FOR today is
    // created outside today's window, and a no-show swept overnight was
    // created days before it was marked. Either window alone silently drops
    // rows the guard needs to see today, so match visits created today OR
    // scheduled for today.
    const { data } = await supabase
      .from('visits')
      .select('id, status, checked_in_at, scheduled_for')
      .or(
        `and(created_at.gte.${start},created_at.lte.${end}),` +
        `and(scheduled_for.gte.${start},scheduled_for.lte.${end}),` +
        // Open statuses, unbounded — the same window Console.loadVisits uses,
        // and for the same reason. A visitor who came in at 21:00 yesterday and
        // has not left is on the premises NOW; a day-bounded query drops them at
        // midnight and the "Inside Now" tile quietly under-counts the building.
        // The invariant survives: every row with checked_in_at is either
        // checked_in or checked_out, so entered === inside + checkedOut still
        // holds over whatever set is in view.
        `status.in.(pending_approval,walkin_approved,checked_in)`,
      );

    const rows = (data ?? []) as Row[];
    const now = Date.now();

    setStats({
      // Cumulative, NOT status-derived — see the note above.
      entered: rows.filter((r) => r.checked_in_at !== null).length,
      inside: rows.filter((r) => r.status === 'checked_in').length,
      checkedOut: rows.filter((r) => r.status === 'checked_out').length,
      declined: rows.filter((r) => r.status === 'rejected').length,
      noShow: rows.filter((r) => r.status === 'no_show').length,
      awaitingApproval: rows.filter((r) => r.status === 'pending_approval').length,
      // Expected, had a booked time, and that time has already gone by.
      overdue: rows.filter((r) =>
        IS_EXPECTED[r.status] === true &&
        r.scheduled_for !== null &&
        new Date(r.scheduled_for).getTime() < now,
      ).length,
      // Inside for longer than anyone plausibly is. Almost always a check-out
      // the gate forgot rather than a visitor who is genuinely still here, and
      // it is worth a guard's attention BEFORE the nightly sweep closes it:
      // a guard who checks them out records a verified exit, where the sweep
      // can only record that we stopped believing the row (migration 067).
      overstaying: rows.filter((r) => isOverstaying(r)).length,
    });
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel('guard-gate-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  return { stats, loading };
}
