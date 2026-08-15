import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { isDueToday, istDateKey } from './visitExpiry';

export type PreApprovalFilter = 'today' | 'upcoming' | 'all';

export type UsePreApprovals = {
  visits: Visit[];
  loading: boolean;
};

// Keyed predicates, not string matching — see CLAUDE.md "No fuzzy string
// matching for known enums".
//
// `today` used to be `new Date().toISOString().slice(0, 10)` — the UTC date —
// compared against a UTC slice of scheduled_for. This is an IST deployment, so
// between 00:00 and 05:30 IST the app thought today was yesterday: a visit
// booked for 01:00 IST was filed under the previous day and was invisible on the
// morning it was due. istDateKey does the comparison in the deployment's own
// timezone, and isDueToday folds in "not expired, not already arrived".
const FILTER_PREDICATES: Record<PreApprovalFilter, (v: Visit, today: string) => boolean> = {
  today: (v) => isDueToday(v),
  upcoming: (v, today) => !!v.scheduled_for && istDateKey(v.scheduled_for) > today,
  all: () => true,
};

// Scheduled pre-approved visits (status = 'approved') not yet checked in,
// filtered by arrival window. Mirrors useExpectedToday's fetch/realtime shape.
export function usePreApprovals(filter: PreApprovalFilter): UsePreApprovals {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  // One realtime topic PER HOOK INSTANCE. supabase.channel(name) returns the
  // channel already registered under that topic, so two components (or one
  // component calling this hook twice, as the HOD console does for 'today' and
  // 'upcoming') both reached for the same 'guard-pre-approvals' channel — and
  // the second .on() landed after the first had already subscribe()d, which
  // supabase-js throws on. The throw happened inside a passive effect, so React
  // unmounted the whole tree and the app went WHITE, sign-in screen included.
  const topic = `pre-approvals-${useId()}`;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('status', 'approved');
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);

    const today = istDateKey(new Date());
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
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, topic]);

  return { visits, loading };
}
