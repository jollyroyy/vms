import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { BadgePrint } from '../types/index';
import { istDayStart } from './visitExpiry';

// The badge-print log (migration 087) — a READ, never a write. Minting a
// badge stays at the gate, with the guard who can see the visitor; this hook
// exists only so the admin tab can report on what already happened there.
//
// Modelled on `useVisitFeedback.ts`: a separate hook rather than a join onto
// `useAdminVisits`, because `badge_prints` is its own table with its own RLS
// (guard/HOD/admin can read it, nobody else) and its own window — a badge is
// printed at some point after the visit row exists, so tying the two windows
// together would drop a same-day reprint of a visit that arrived yesterday.
//
// The join reaches through to the visit, the visitor and the host in one
// select so the table this feeds never has to chase a second query per row —
// the same reasoning `ADMIN_VISIT_SELECT` is written for.

const BADGE_PRINT_SELECT = `
  *,
  visit:visits(
    *,
    visitor:visitors(*),
    department:departments(id, name, code, created_at),
    host:profiles!visits_host_id_fkey(id, full_name)
  ),
  printed_by_profile:profiles!badge_prints_printed_by_fkey(id, full_name)
`;

/** `BadgePrint` plus the resolved name of the guard who printed it — joined
 *  here rather than added to the shared type, since nothing outside this tab
 *  needs "who pressed print" as a name rather than an id. */
export type BadgePrintRow = BadgePrint & {
  printed_by_profile?: { id: string; full_name: string } | null;
};

type State = { prints: BadgePrintRow[]; loading: boolean };

/**
 * Badge prints for a window.
 *
 * `sinceDayStart = true` is the KPI tiles' window — today only, IST.
 * `sinceDayStart = false` (with `limit`) is the table underneath them: the
 * most recent prints in any state, for a register that outlives one day.
 */
export function useBadgePrints(sinceDayStart = true, limit = 50): State & { reload: () => void } {
  const [state, setState] = useState<State>({ prints: [], loading: true });

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));

    let q = supabase.from('badge_prints').select(BADGE_PRINT_SELECT).order('printed_at', { ascending: false });
    if (sinceDayStart) q = q.gte('printed_at', istDayStart().toISOString());
    else q = q.limit(limit);

    const { data } = await q;
    setState({ prints: (data as unknown as BadgePrintRow[]) ?? [], loading: false });
  }, [sinceDayStart, limit]);

  useEffect(() => { void load(); }, [load]);

  // Realtime, silent — a badge printed at the gate while the admin has this
  // tab open must not flash the KPI numbers back to em dashes.
  useEffect(() => {
    const ch = supabase
      .channel(`admin-badge-prints-${sinceDayStart}-${limit}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_prints' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [sinceDayStart, limit, load]);

  return { ...state, reload: () => void load(true) };
}
