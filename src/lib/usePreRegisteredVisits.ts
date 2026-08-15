import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { ReportVisit } from './reportRow';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { attachVisitActors } from './visitActors';
import { visitOrigin } from './visitOrigin';

// EVERY visitor who was ever pre-registered, not just today's (client
// instruction, 2026-08-15).
//
// The Pre-Registered board used to read `useTodayVisits`, whose window is
// created-today OR scheduled-today OR an open status. That is the right window
// for the dashboard, which answers "what is happening now", and the wrong one
// for a board whose whole subject is the pre-registration record: a visitor who
// came last week was simply not in it, so the tab could not answer the question
// its own name asks. Today-ness is a FILTER on this board (the Arriving Today
// chip and the Today at a Glance rail), never the fetch — the same separation
// CLAUDE.md draws between browsing and searching on the check-in desk.
//
// It is a separate hook rather than a widening of `useTodayVisits` because that
// hook feeds the dashboard tiles, and CLAUDE.md's rule there is that a tile's
// count is the length of the list it opens. Widening its window to all history
// would silently change every one of those counts.

/** All-history means unbounded, and unbounded means a cap. Newest first, so
 *  the cut falls on the oldest rows — the ones a guard is least likely to be
 *  looking for on a board about arrivals. */
export const PRE_REGISTERED_LIMIT = 500;

export type UsePreRegisteredVisits = {
  visits: ReportVisit[];
  loading: boolean;
  /** True when the cap was hit, so the board can say the list is not complete
   *  rather than quietly presenting a truncated record as the whole one. */
  truncated: boolean;
};

export function usePreRegisteredVisits(): UsePreRegisteredVisits {
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // Server-side this is the widest net that is still cheap: a pre-approval
    // always carries `scheduled_for` (validatePreApproval makes it mandatory),
    // and `approved` catches the pre-validation rows that do not. `visitOrigin`
    // below is what actually decides — it is this repo's one answer to
    // "pre-approved or walk-in", so the board cannot drift from the cards.
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .or('scheduled_for.not.is.null,status.eq.approved')
      .order('scheduled_for', { ascending: false, nullsFirst: false })
      .limit(PRE_REGISTERED_LIMIT);

    const rows = ((data as unknown as Visit[]) ?? []);
    setTruncated(rows.length >= PRE_REGISTERED_LIMIT);
    const named = await attachHostNames(rows.filter((v) => visitOrigin(v) === 'pre_approved'));
    // Approval instants live in audit_logs, not on the visit row.
    const withActors = await attachVisitActors(named);
    setVisits(withActors.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-pre-registered-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visits, loading, truncated };
}
