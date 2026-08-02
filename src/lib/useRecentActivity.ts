import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';

// The gate log: the most recent visits today whatever their status, newest
// first. Distinct from useInsideNow (live occupancy) and useExpectedToday
// (still to arrive) — this is the "what just happened" feed, so a checked-out
// visitor still belongs here.
export function useRecentActivity(today: string, limit = 8): { visits: Visit[]; loading: boolean } {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false })
      .limit(limit);

    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    setVisits(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, [today, limit]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel('guard-recent-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  return { visits, loading };
}
