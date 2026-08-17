import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { BadgePrint } from '../types/index';

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
//
// RANGED, NOT TODAY-ONLY (client instruction, 2026-08-17). The tab used to
// take `sinceDayStart` and hardcode `istDayStart()` as its only window; it is
// now a date-ranged historical tab like the rest of the admin console, and the
// range comes from the caller (`AdminBadges`'s `preset`/`endDate` state via
// `computeDateRange`) rather than being decided in here.

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

/** Inclusive `YYYY-MM-DD` range, the same shape `computeDateRange` returns —
 *  one range vocabulary across the ranged admin tabs, per `reportsDateRange.ts`. */
export type BadgePrintRange = { from: string; to: string };

type State = { prints: BadgePrintRow[]; loading: boolean };

/**
 * Instant bounds for a `YYYY-MM-DD` range, as ISO strings. Mirrors
 * `windowBounds` in `useAdminVisits.ts`: a date-only key is midnight IST of
 * that day, and the upper bound is the start of the day AFTER `to` rather
 * than `to`'s own 23:59:59 — a `<` on the next boundary instead of a `<=` on
 * the last second of the day, because the last second is exactly where a real
 * print at a busy gate lands, and a hand-typed 23:59:59 can lose it to
 * rounding in a way a clean boundary comparison cannot.
 */
function rangeBounds(range: BadgePrintRange): { from: string; to: string } {
  const startOfTo = new Date(`${range.to}T00:00:00+05:30`).getTime();
  return {
    from: new Date(`${range.from}T00:00:00+05:30`).toISOString(),
    to: new Date(startOfTo + 86400000).toISOString(),
  };
}

/**
 * Badge prints for a date range, refreshed live.
 *
 * `limit` caps the rows fetched — a year-long range at a busy gate can hold
 * more than PostgREST's default page, and a silent truncation here would be
 * the same defect `windowBounds`'s comment warns about on the visits query:
 * an admin who cannot find a print concludes it never happened, when the
 * truth is a cap nobody told them about.
 */
export function useBadgePrints(range: BadgePrintRange, limit = 500): State & { reload: () => void } {
  const [state, setState] = useState<State>({ prints: [], loading: true });

  // The three PRIMITIVES are the dependencies, never the `range` object: a
  // caller building `{ from, to }` inline hands us a new object identity on
  // every render, which would re-run the effect — and re-fetch — forever.
  // Destructuring is what makes the deps compare by value, and it does so
  // without the serialize-and-split round trip `useAdminVisits` needs for its
  // discriminated-union window.
  const { from, to } = range;
  const key = `${from}:${to}:${limit}`;

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));

    const bounds = rangeBounds({ from, to });
    const { data } = await supabase
      .from('badge_prints')
      .select(BADGE_PRINT_SELECT)
      .gte('printed_at', bounds.from)
      .lt('printed_at', bounds.to)
      .order('printed_at', { ascending: false })
      .limit(limit);

    setState({ prints: (data as unknown as BadgePrintRow[]) ?? [], loading: false });
  }, [from, to, limit]);

  useEffect(() => { void load(); }, [load]);

  // Realtime, silent — a badge printed at the gate while the admin has this
  // tab open must not flash the KPI numbers back to em dashes. Keyed on the
  // range so switching periods tears down the old subscription and opens a
  // fresh one, rather than a stale listener from a discarded range reloading
  // a state nothing on screen still points at.
  useEffect(() => {
    const ch = supabase
      .channel(`admin-badge-prints-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_prints' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [key, load]);

  return { ...state, reload: () => void load(true) };
}
