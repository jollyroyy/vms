import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { istDayStart } from './visitExpiry';

// The admin surface's one visit query.
//
// Seven of the nine admin tabs are a window over `visits` with the same four
// joins. Writing that select seven times is seven chances for one tab to
// forget the entry-point join and silently report every arrival as "not
// recorded", or to miss the visitor join and print a blank name — so it is
// written once, here, and the tabs differ only in their window and in how they
// slice what comes back.
//
// ADMIN IS EXEMPT FROM THE DEPARTMENT FILTER, the same exemption Reports.tsx
// already carries. An HOD's screens are scoped to their own department; the
// admin's are the org, which is the whole reason these tabs exist.
//
// THIS HOOK NEVER WRITES. The admin's visitor access is read-only by
// instruction (2026-08-17) and there is deliberately no mutation exported from
// this file — a check-in, a check-out, an approval or a badge is the gate's,
// and the absence of a writer here is what makes that structural rather than a
// matter of which buttons a page happened to render.

export const ADMIN_VISIT_SELECT = `
  *,
  visitor:visitors(*),
  department:departments(id, name, code, created_at),
  host:profiles!visits_host_id_fkey(id, full_name),
  entry_point:entry_points(id, name, code, kind, active, sort_order, created_at)
`;

export type VisitWindow =
  /** The IST day that is running now. Never a UTC day — between 00:00 and
   *  05:30 IST a UTC window reports yesterday, which is when a night shift is
   *  most likely to be reading the screen. */
  | { kind: 'today' }
  /** An inclusive IST date range, both ends as `YYYY-MM-DD`. */
  | { kind: 'range'; from: string; to: string }
  /** The most recent `limit` visits in any state, newest first — the Visitors
   *  Log, which is a register and not a day. */
  | { kind: 'recent'; limit: number };

/** Bounds for a window, as ISO instants. `null` upper bound = open-ended. */
export function windowBounds(win: VisitWindow, now = new Date()): { from: string | null; to: string | null } {
  if (win.kind === 'today') return { from: istDayStart(now).toISOString(), to: null };
  if (win.kind === 'recent') return { from: null, to: null };
  // A date-only string is midnight IST of that day. The upper bound is the
  // start of the day AFTER `to`, so the last day of the range is fully
  // included — a `<` on the next boundary rather than a `<=` on 23:59:59,
  // which would lose the final second of the range and with it a real visit at
  // a busy gate.
  const startOfTo = new Date(`${win.to}T00:00:00+05:30`).getTime();
  return {
    from: new Date(`${win.from}T00:00:00+05:30`).toISOString(),
    to: new Date(startOfTo + 86400000).toISOString(),
  };
}

type State = { visits: Visit[]; loading: boolean; error: string | null };

/**
 * Visits for a window, refreshed live.
 *
 * `silent` on the realtime path, the same convention the rest of the app uses:
 * a live update must not flash the KPI numbers back to em dashes while the
 * admin is reading them.
 */
export function useAdminVisits(win: VisitWindow): State & { reload: () => void } {
  const [state, setState] = useState<State>({ visits: [], loading: true, error: null });

  const key = JSON.stringify(win);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));
    const parsed = JSON.parse(key) as VisitWindow;

    let q = supabase.from('visits').select(ADMIN_VISIT_SELECT).order('created_at', { ascending: false });

    if (parsed.kind === 'recent') {
      q = q.limit(parsed.limit);
    } else {
      const { from, to } = windowBounds(parsed);
      // The window is on `created_at` OR on the arrival, because a visitor who
      // was booked last week and walked in today belongs to today's screens.
      // Without the second clause the Live Check-In tab loses exactly the
      // pre-approvals it exists to show.
      if (from && to) q = q.or(`and(created_at.gte.${from},created_at.lt.${to}),and(checked_in_at.gte.${from},checked_in_at.lt.${to})`);
      else if (from) q = q.or(`created_at.gte.${from},checked_in_at.gte.${from},status.in.(pending_approval,walkin_approved,checked_in)`);
    }

    const { data, error } = await q;
    setState({
      visits: (data as unknown as Visit[]) ?? [],
      loading: false,
      error: error ? error.message : null,
    });
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`admin-visits-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [key, load]);

  return { ...state, reload: () => void load(true) };
}
