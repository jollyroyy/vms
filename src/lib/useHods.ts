// Live list of every head of department, keyed by department on the consumer side.
// Subscribes to postgres_changes on `profiles` so promoting, renaming or demoting an
// HOD in the Admin Panel is reflected everywhere at once. Requires `profiles` in the
// supabase_realtime publication (supabase/migrations/039_realtime_departments_profiles.sql).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Profile } from '../types/index';

export type UseHods = {
  hods: Profile[];
  loading: boolean;
  reload: () => Promise<void>;
};

export function useHods(): UseHods {
  const [hods, setHods] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'hod')
      .order('full_name');
    setHods(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel('hods-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { hods, loading, reload: load };
}
