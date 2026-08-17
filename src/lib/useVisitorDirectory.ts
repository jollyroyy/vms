// Live list of every visitor row, for the admin Blacklist & Security tab.
//
// Modelled on useHods.ts / useDepartments.ts: fetch, subscribe to
// `postgres_changes`, never a one-shot read that goes stale the moment
// another admin flags someone from a second tab.
//
// UNFILTERED ON PURPOSE. The query does not say `.eq('is_blacklisted', true)`
// so that `lib/adminSecurity.ts`'s `blacklistedVisitors` filter is the one
// place membership in the Blacklist panel is decided — mirroring
// `useAdminVisits` fetching a window and `guardTiles.ts` slicing it, rather
// than splitting the same rule across a query and a component.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Visitor } from '../types/index';

export type UseVisitorDirectory = {
  visitors: Visitor[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useVisitorDirectory(): UseVisitorDirectory {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('visitors')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setVisitors((data as unknown as Visitor[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('visitor-directory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { visitors, loading, error, reload: load };
}
