import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

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
export type GateStats = {
  preApproved: number;   // status === 'approved' — booked in advance
  walkInApproved: number; // status === 'walkin_approved' — approved at the gate
  entered: number;     // cumulative — everyone who checked in today
  inside: number;      // live — still on the premises
  checkedOut: number;  // came and left
  declined: number;    // HOD rejected the request (usually before arrival)
  // Queue counts — what still needs a human to do something
  awaitingApproval: number; // raised at the gate, waiting on an HOD decision
  overdue: number;          // approved, scheduled arrival already passed
};

const EMPTY: GateStats = {
  preApproved: 0, walkInApproved: 0, entered: 0, inside: 0, checkedOut: 0, declined: 0,
  awaitingApproval: 0, overdue: 0,
};

type Row = {
  id: string;
  status: string;
  checked_in_at: string | null;
  scheduled_for: string | null;
};

// Which statuses count as "still expected at the gate". A pre-approval is
// INSERTed already `approved`; a walk-in becomes `walkin_approved` when the HOD
// says yes. Lookup map rather than an includes() chain, per CLAUDE.md.
//
// The tile split into `preApproved` / `walkInApproved` below, but `overdue`
// MUST keep covering both statuses — a visitor is overdue whichever route got
// them approved, so do not narrow this to one status.
const IS_EXPECTED: Record<string, boolean> = {
  approved: true,
  walkin_approved: true,
};

export function useGateStats(today: string): { stats: GateStats; loading: boolean } {
  const [stats, setStats] = useState<GateStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select('id, status, checked_in_at, scheduled_for')
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);

    const rows = (data ?? []) as Row[];
    const now = Date.now();

    setStats({
      preApproved: rows.filter((r) => r.status === 'approved').length,
      walkInApproved: rows.filter((r) => r.status === 'walkin_approved').length,
      // Cumulative, NOT status-derived — see the note above.
      entered: rows.filter((r) => r.checked_in_at !== null).length,
      inside: rows.filter((r) => r.status === 'checked_in').length,
      checkedOut: rows.filter((r) => r.status === 'checked_out').length,
      declined: rows.filter((r) => r.status === 'rejected').length,
      awaitingApproval: rows.filter((r) => r.status === 'pending_approval').length,
      // Expected, had a booked time, and that time has already gone by.
      overdue: rows.filter((r) =>
        IS_EXPECTED[r.status] === true &&
        r.scheduled_for !== null &&
        new Date(r.scheduled_for).getTime() < now,
      ).length,
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
