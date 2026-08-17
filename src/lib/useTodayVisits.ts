import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { ReportVisit } from './reportRow';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { attachVisitActors } from './visitActors';
import { istDayStart } from './visitExpiry';

export type UseTodayVisits = {
  visits: ReportVisit[];
  loading: boolean;
};

// Every visit created today, whatever its status.
//
// This replaced useInsideNow, which fetched `status = 'checked_in'` only. The
// dashboard's KPI tiles now all drill down in place, and each one needs a
// different slice of the same day — expected, inside, entered, checked out,
// declined. Five status-filtered queries would mean five subscriptions and five
// chances for the tile count and the expanded list to disagree, so this fetches
// the day once and lib/guardTiles.ts slices it client-side (one predicate per
// tile; the count IS the list length).
export function useTodayVisits(today: string): UseTodayVisits {
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const start = `${today}T00:00:00Z`;
    const end = `${today}T23:59:59Z`;
    // Same widened window as useGateStats.ts, and it must stay in lockstep:
    // this feeds the drill-down LIST for the same tiles that hook counts. A
    // pre-approval created last week for today, or a no-show swept overnight
    // (created days ago), falls outside created_at alone — match created
    // today OR scheduled for today so the list never disagrees with the count.
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .or(
        `and(created_at.gte.${start},created_at.lte.${end}),` +
        `and(scheduled_for.gte.${start},scheduled_for.lte.${end}),` +
        // Open statuses, UNBOUNDED — the third clause useGateStats has always
        // carried, and the reason the two hooks are now in lockstep. Without it
        // a visitor who came in at 21:00 yesterday and has not left falls out of
        // this list at midnight while still being counted as inside, so the
        // "In Premises" tile and the cards under it disagreed by exactly the
        // people it is most dangerous to lose track of.
        `status.in.(pending_approval,walkin_approved,checked_in),` +
        // TODAY'S DEPARTURES, by the IST day (added 2026-08-17 with the
        // Checked Out tile). A visitor who came in at 21:00 yesterday and left
        // at 09:00 this morning was created yesterday, scheduled yesterday and
        // is no longer in an open status — so every clause above misses them,
        // and they are exactly the exit a guard is most often asked about. The
        // rule CLAUDE.md sets for this case is to WIDEN this hook rather than
        // add a second query, so the tile's count stays the length of the list
        // it opens.
        //
        // `istDayStart`, never `${today}T00:00:00Z`: the IST day opens at
        // 18:30 UTC the previous evening, and a UTC boundary drops every exit
        // made between 00:00 and 05:30 IST.
        `checked_out_at.gte.${istDayStart(new Date()).toISOString()}`,
      );
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    // Approval timestamps live in audit_logs, not on the visit row — the cards
    // display the approval timestamp, which is only accessible via audit_logs.
    const withActors = await attachVisitActors(rows);
    setVisits(withActors.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-today-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visits, loading };
}
