import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';

export type PreApprovalFilter = 'today' | 'upcoming' | 'all';

export type UsePreApprovals = {
  visits: Visit[];
  loading: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Keyed predicates, not string matching — see CLAUDE.md "No fuzzy string
// matching for known enums".
const FILTER_PREDICATES: Record<PreApprovalFilter, (v: Visit, today: string) => boolean> = {
  today: (v, today) => {
    if (v.scheduled_for) return v.scheduled_for.slice(0, 10) === today;
    return v.created_at.slice(0, 10) === today;
  },
  upcoming: (v, today) => !!v.scheduled_for && v.scheduled_for.slice(0, 10) > today,
  all: () => true,
};

// Scheduled pre-approved visits (status = 'approved') not yet checked in,
// filtered by arrival window. Mirrors useExpectedToday's fetch/realtime shape.
export function usePreApprovals(filter: PreApprovalFilter): UsePreApprovals {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('status', 'approved');
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);

    const today = todayIso();
    const predicate = FILTER_PREDICATES[filter];
    rows = rows.filter((v) => predicate(v, today));

    rows.sort((a, b) => {
      const at = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
      const bt = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setVisits(rows);
    if (!silent) setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-pre-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visits, loading };
}
