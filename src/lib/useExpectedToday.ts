import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';

export type UseExpectedToday = {
  visits: Visit[];
  loading: boolean;
};

// Every visitor still expected at the gate today — pre-approved or walk-in
// approved, sorted so the next scheduled arrival is always first (open-ended
// pre-approvals with no scheduled_for sort last, by when they were approved).
export function useExpectedToday(today: string): UseExpectedToday {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .in('status', ['approved', 'walkin_approved'])
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    rows.sort((a, b) => {
      const at = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
      const bt = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    setVisits(rows);
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-expected-today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visits, loading };
}
