import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { ReportVisit } from './reportRow';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { attachVisitActors } from './visitActors';
import { istDayStart } from './visitExpiry';

// Who is inside, plus who has left today — the Entry & Exit tab's whole list.
//
// The tab used to be Inside Now and read `useTodayVisits`, filtering it down to
// `status = 'checked_in'`. Widening it to include departures could not be done
// by relaxing that filter, for two separate reasons:
//
//  * `useTodayVisits` feeds the dashboard's KPI tiles, and CLAUDE.md's rule
//    there is that a tile's count is the length of the list it opens. Its
//    window is the dashboard's window; changing it changes every tile.
//  * Its window would have been WRONG here anyway. A visitor who came in at
//    21:00 yesterday and left at 09:00 this morning was neither created today
//    nor scheduled today, and `checked_out` is not one of the open statuses it
//    carries unbounded — so the one exit a guard is most likely to be asked
//    about, the one that crossed midnight, is exactly the row that would have
//    been missing.
//
// So the window is stated directly: every visit that has actually been through
// the gate (`checked_in_at` is not null) AND is either still inside — unbounded,
// because someone inside is inside regardless of which day they arrived — or
// checked out since the IST day began.

export type UseGateActivity = {
  visits: ReportVisit[];
  loading: boolean;
};

export function useGateActivity(dayKey: string): UseGateActivity {
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // istDayStart, not `${dayKey}T00:00:00Z`: the IST day starts at 18:30 UTC
    // the previous evening, and a UTC midnight here would drop every exit made
    // between 00:00 and 05:30 IST — the same bug CLAUDE.md records against
    // `new Date().toISOString().slice(0, 10)`.
    const since = istDayStart(new Date()).toISOString();
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .not('checked_in_at', 'is', null)
      .or(`status.eq.checked_in,checked_out_at.gte.${since}`);

    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    // Approval instants live in audit_logs, not on the visit row — the frame's
    // timeline prints one for pre-approved visitors.
    const withActors = await attachVisitActors(rows);
    setVisits(withActors.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, [dayKey]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-gate-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visits, loading };
}
