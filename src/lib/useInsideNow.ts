import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { ReportVisit } from './reportRow';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { attachVisitActors } from './visitActors';

export type UseInsideNow = {
  visits: ReportVisit[];
  loading: boolean;
};

// Every visitor currently checked in — sorted most recently checked in first,
// with null checked_in_at timestamps sorting last.
export function useInsideNow(today: string): UseInsideNow {
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('status', 'checked_in')
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    // Approval timestamps live in audit_logs, not on the visit row — the cards
    // display the approval timestamp, which is only accessible via audit_logs.
    const withActors = await attachVisitActors(rows);
    const enriched = withActors.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined }));
    enriched.sort((a, b) => {
      const at = a.checked_in_at ? new Date(a.checked_in_at).getTime() : -Infinity;
      const bt = b.checked_in_at ? new Date(b.checked_in_at).getTime() : -Infinity;
      return bt - at;
    });
    setVisits(enriched);
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-inside-now')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visits, loading };
}
