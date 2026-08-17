// The blacklist-removal queue, live.
//
// Modelled on `useVisitorDirectory.ts`: fetch, subscribe to
// `postgres_changes`, never a one-shot read. Live matters more here than on
// most screens — the admin who filed a request and the CEO deciding it are two
// people looking at the same row at the same time, and the admin must see
// "Approved" appear without being told to refresh.
//
// UNFILTERED BY STATUS ON PURPOSE, the same call `useVisitorDirectory` makes:
// the query is the window and the caller does the slicing, so the CEO's
// pending queue and the admin's history panel cannot end up disagreeing about
// what "pending" means. The cap is explicit for the reason every ranged admin
// fetch states one — PostgREST applies a maximum of its own when none is
// given, and a silently truncated queue is a request nobody is told is
// waiting.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { BlacklistRemovalRequest } from '../types/index';

export const REMOVAL_QUEUE_LIMIT = 200;

// The two profile joins are DISAMBIGUATED BY CONSTRAINT NAME, not by column:
// `requested_by` and `decided_by` both point at `profiles`, so PostgREST
// cannot pick one from the table name alone and returns a "more than one
// relationship" error if asked to.
const REMOVAL_SELECT = `
  *,
  visitor:visitors(id, full_name, phone, vendor_name, is_blacklisted),
  requester:profiles!blacklist_removal_requests_requested_by_fkey(id, full_name),
  decider:profiles!blacklist_removal_requests_decided_by_fkey(id, full_name)
`;

export type UseBlacklistRemovals = {
  requests: BlacklistRemovalRequest[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useBlacklistRemovals(): UseBlacklistRemovals {
  const [requests, setRequests] = useState<BlacklistRemovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('blacklist_removal_requests')
      .select(REMOVAL_SELECT)
      .order('created_at', { ascending: false })
      .limit(REMOVAL_QUEUE_LIMIT);
    // A failed read must never masquerade as an empty queue — that is how the
    // profiles policy recursion hid itself in migration 040, and here it would
    // tell a CEO nobody is waiting on them.
    if (err) setError(err.message);
    else {
      setError(null);
      setRequests((data as unknown as BlacklistRemovalRequest[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('blacklist-removals-live')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'blacklist_removal_requests' },
          () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { requests, loading, error, reload: load };
}

/** Requests still waiting on the CEO, oldest first — a queue is worked
 *  forwards, and the longest wait is the one that needs deciding. */
export function pendingRemovals(rows: BlacklistRemovalRequest[]): BlacklistRemovalRequest[] {
  return rows
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Requests that have been decided, most recent decision first. */
export function decidedRemovals(rows: BlacklistRemovalRequest[]): BlacklistRemovalRequest[] {
  return rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => (b.decided_at ?? '').localeCompare(a.decided_at ?? ''));
}

/** Is there already an open request for this visitor? The unique index makes a
 *  second one fail at the database, so the screen asks this first and shows
 *  "Awaiting CEO approval" instead of offering a button that can only error. */
export function hasOpenRemoval(rows: BlacklistRemovalRequest[], visitorId: string): boolean {
  return rows.some((r) => r.visitor_id === visitorId && r.status === 'pending');
}
