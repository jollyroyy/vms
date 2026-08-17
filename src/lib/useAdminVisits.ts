import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { istDayStart } from './visitExpiry';
import { rangeBounds } from './reportsDateRange';

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
  host:profiles!visits_host_id_fkey(id, full_name, avatar_url)
`;
// `entry_point` was joined here for the Entry Point Utilization panel and is
// gone with it (2026-08-17, client instruction). Nothing on the admin surface
// reads a door, so re-adding the embed would ship a table's worth of rows to
// every tab for a value no screen renders.

export type VisitWindow =
  /** The IST day that is running now. Never a UTC day — between 00:00 and
   *  05:30 IST a UTC window reports yesterday, which is when a night shift is
   *  most likely to be reading the screen. */
  | { kind: 'today' }
  /** An inclusive IST date range, both ends as `YYYY-MM-DD`.
   *
   *  `limit` caps the rows fetched. It is OPTIONAL but every ranged tab passes
   *  one, because PostgREST applies a default maximum of its own when none is
   *  given — and a silent truncation is the worst failure this console can
   *  have: an admin who selects "Last 1 Year", finds no Mr Mehta and concludes
   *  the visit never happened has been misled by a cap nobody told them about.
   *  Passing it explicitly is what lets the page compare `rows.length` against
   *  a number it knows and say so on screen.
   *
   *  `includeUpcoming` ORs in every still-open pre-approval booked for a
   *  future moment, whatever the range says. The range clauses below are on
   *  `created_at` and `checked_in_at` ONLY — there is no `scheduled_for`
   *  clause — so without this a booking raised forty days ago for next week
   *  falls out of a thirty-day window entirely: it was not created in the
   *  period and it has not arrived. That is a visitor the building is
   *  expecting, dropped off the one screen whose job is listing them, and it
   *  is invisible rather than merely absent — the admin has no reason to widen
   *  a range to look for something they have not been told is missing. Only
   *  the Pre-Registration tab asks for it; a log of what happened must not
   *  quietly gain rows for things that have not.
   *
   *  `includeInside` ORs in everyone currently `checked_in`, whatever the range
   *  says. Only the Blacklist & Security tab asks for it, and it is not a
   *  convenience: that tab's overstay alerts are LIVE by definition — somebody
   *  is in the building past their deadline right now — but the predicate can
   *  only see rows the query loaded, so an admin who narrowed the range to a
   *  past week would have been shown an empty Security Alerts panel while a
   *  visitor was overdue in the building. A screen that reports "nobody is
   *  overstaying" when somebody is, is the one failure mode this tab exists to
   *  prevent. */
  | {
      kind: 'range'; from: string; to: string; limit?: number;
      includeUpcoming?: boolean; includeInside?: boolean;
    }
  /** The most recent `limit` visits in any state, newest first — the Visitors
   *  Log, which is a register and not a day. */
  | { kind: 'recent'; limit: number };

/** Bounds for a window, as ISO instants. `null` upper bound = open-ended. */
export function windowBounds(win: VisitWindow, now = new Date()): { from: string | null; to: string | null } {
  if (win.kind === 'today') return { from: istDayStart(now).toISOString(), to: null };
  if (win.kind === 'recent') return { from: null, to: null };
  // What an inclusive IST date range means is defined once, in the file that
  // owns the range vocabulary — Reports resolves its own window through the
  // same function, so the register and the admin tabs cannot disagree about
  // which instants "17 Aug" covers.
  return rangeBounds({ from: win.from, to: win.to });
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
      const extra = parsed.kind !== 'range' ? '' : [
        parsed.includeUpcoming ? `and(status.eq.approved,scheduled_for.gte.${new Date().toISOString()})` : '',
        parsed.includeInside ? 'status.eq.checked_in' : '',
      ].filter(Boolean).map((clause) => `,${clause}`).join('');
      if (from && to) q = q.or(`and(created_at.gte.${from},created_at.lt.${to}),and(checked_in_at.gte.${from},checked_in_at.lt.${to})${extra}`);
      else if (from) q = q.or(`created_at.gte.${from},checked_in_at.gte.${from},status.in.(pending_approval,walkin_approved,checked_in)`);
      if (parsed.kind === 'range' && parsed.limit) q = q.limit(parsed.limit);
    }

    const { data, error } = await q;
    // `photo_url` is the app-wide name for the face on a visit, and EVERY other
    // hook that feeds a list maps it here (`useTodayVisits`, `useGateActivity`,
    // `Console.loadVisits`, `Reports`). This one did not, so every admin tab
    // rendered a two-letter monogram for visitors whose photo was sitting in
    // the row it had just fetched — the check-in photo is mandatory on every
    // path, so that is the whole arrived population.
    setState({
      visits: ((data as unknown as Visit[]) ?? []).map((v) => ({
        ...v,
        photo_url: v.photo_data ?? undefined,
      })),
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
