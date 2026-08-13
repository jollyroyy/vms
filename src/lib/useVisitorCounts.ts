// Live counts for the Visitors sub-nav badges.
//
// The sidebar is mounted on every screen, so this cannot reuse the page's own
// fetch — but it must not invent a second definition of "what counts as
// Expected" either. It loads the SAME window the page loads
// (visitorLoadFilter) and slices it with the SAME predicates (SEGMENT_FILTER),
// so the badge beside a nav item and the number at the top of the page it
// opens are computed identically. If they ever disagree on screen, they are
// disagreeing about the data, not about the rule.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { istDateKey } from './visitExpiry';
import {
  SEGMENT_FILTER, VISITOR_SEGMENTS, visitorLoadFilter,
  type VisitorSegment, type ListSegment,
} from './visitorSegments';

export type VisitorCounts = Partial<Record<VisitorSegment, number>>;

export function useVisitorCounts(enabled: boolean): VisitorCounts {
  const [counts, setCounts] = useState<VisitorCounts>({});

  const load = useCallback(async () => {
    if (!enabled) return;
    // IST, not UTC. `toISOString().slice(0,10)` is the UTC date, so between
    // 00:00 and 05:30 IST the badge would count yesterday.
    const today = istDateKey(new Date());
    const { data, error } = await supabase
      .from('visits')
      .select('id, status, checked_in_at, checked_out_at, scheduled_for, expected_departure, created_at')
      .or(visitorLoadFilter(today));
    if (error) return;
    const rows = ((data as unknown as Visit[]) ?? []);
    const next: VisitorCounts = {};
    VISITOR_SEGMENTS.forEach((seg) => {
      const filter = SEGMENT_FILTER[seg as ListSegment];
      if (filter) next[seg] = rows.filter(filter).length;
    });
    setCounts(next);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    void load();
    const channel = supabase
      .channel('sidebar-visitor-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled, load]);

  return counts;
}
