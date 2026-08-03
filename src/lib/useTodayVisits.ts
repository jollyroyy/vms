import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { ReportVisit } from './reportRow';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { attachVisitActors } from './visitActors';

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
// the day once and lib/dashboardDrill.ts slices it client-side.
export function useTodayVisits(today: string): UseTodayVisits {
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);
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
