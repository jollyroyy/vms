import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// A flagged visitor: the full watchlist row, sourced straight from
// visitors.is_blacklisted / visitors.blacklist_reason (the only two columns
// this schema has for flagging someone — see 001_schema.sql).
export type WatchlistEntry = {
  id: string;
  full_name: string;
  phone: string;
  company: string | null;
  blacklist_reason: string | null;
  created_at: string;
};

// A flagged visitor with activity today — the operationally urgent half:
// a guard needs to know they're at the gate right now, not just that a
// watchlist exists.
export type WatchlistAlert = {
  id: string; // visit id
  status: string;
  created_at: string;
  checked_in_at: string | null;
  visitor: {
    id: string;
    full_name: string;
    phone: string;
    blacklist_reason: string | null;
  };
};

export type UseWatchlist = {
  entries: WatchlistEntry[];
  alerts: WatchlistAlert[];
  loading: boolean;
};

export function useWatchlist(): UseWatchlist {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const { data: flagged } = await supabase
      .from('visitors')
      .select('id, full_name, phone, company, blacklist_reason, created_at')
      .eq('is_blacklisted', true)
      .order('created_at', { ascending: false });
    const flaggedRows = (flagged as unknown as WatchlistEntry[]) ?? [];
    setEntries(flaggedRows);

    // The embedded `.eq('visitor.is_blacklisted', true)` filter on an
    // inner-joined embed is not reliable across supabase-js versions (it can
    // silently no-op depending on how PostgREST resolves the embedded
    // table's filter). Fetching flagged visitor ids first and filtering
    // visits with `.in('visitor_id', ids)` is explicit and always works.
    const today = new Date().toISOString().slice(0, 10);
    const flaggedIds = flaggedRows.map((v) => v.id);
    if (flaggedIds.length === 0) {
      setAlerts([]);
      if (!silent) setLoading(false);
      return;
    }

    const { data: visits } = await supabase
      .from('visits')
      .select('id, status, created_at, checked_in_at, visitor:visitors!inner(id, full_name, phone, blacklist_reason)')
      .in('visitor_id', flaggedIds)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false });
    setAlerts((visits as unknown as WatchlistAlert[]) ?? []);

    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('guard-watchlist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { entries, alerts, loading };
}
