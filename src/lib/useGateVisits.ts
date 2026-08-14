// The guard's working set of visits: today's rows, plus every visit still open
// whatever day it was raised on.
//
// Extracted out of pages/Guard/Console.tsx when the Check-in / Check-out desk
// became a second surface that needs the same window. The window itself is
// `visitorLoadFilter`, shared with the sidebar count hook, so the list, the
// counts and the exit lane are all slices of one definition of "what is open".
//
// The date bound is on `created_at` ONLY — the open statuses are never
// date-bounded. A bare `created_at >= today` silently dropped unfinished work
// at midnight: a walk-in registered at 23:50 and approved at 00:05 was approved
// into an empty list, a visitor still inside from the previous evening could
// not be checked out, and a pre-approval booked last week for today never
// appeared at all.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { istDateKey } from './visitExpiry';
import { visitorLoadFilter } from './visitorSegments';

export type GateVisits = {
  visits: Visit[];
  loading: boolean;
  /** `silent` skips the loading flag, so a realtime refresh does not flash the
   *  skeletons back over a list the guard is reading. */
  reload: (silent?: boolean) => Promise<void>;
};

export function useGateVisits(channelName: string): GateVisits {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  // The IST date, not the UTC one. Between 00:00 and 05:30 IST
  // `toISOString().slice(0,10)` is still yesterday, which files a visit booked
  // for 01:00 under the previous day and makes it invisible on the morning it
  // is due. See lib/visitExpiry.
  const [today] = useState(() => istDateKey(new Date()));

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .or(visitorLoadFilter(today))
      .order('created_at', { ascending: false });
    if (error) { console.error('[useGateVisits] load error:', error.message); }
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    setVisits(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void reload();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void reload(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reload, channelName]);

  return { visits, loading, reload };
}
