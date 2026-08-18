// Live list of every head of department, keyed by department on the consumer side.
// Subscribes to postgres_changes on `profiles` so promoting, renaming or demoting an
// HOD in the Admin Panel is reflected everywhere at once. Requires `profiles` in the
// supabase_realtime publication (supabase/migrations/039_realtime_departments_profiles.sql).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Profile } from '../types/index';
import { HOD_ROLES } from './hodRoles';

export type UseHods = {
  hods: Profile[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useHods(): UseHods {
  const [hods, setHods] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A failed read must not masquerade as "no heads of department" — that is exactly
  // how the profiles policy recursion (fixed in migration 040) hid itself: every
  // department card said "No head of department assigned" instead of showing an error.
  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      // EVERY APPROVER ROLE, NOT THE LITERAL 'hod' (2026-08-18). A department is
      // headed by whoever heads it, and since `HOD_ROLES` a senior manager or a
      // staff member holds exactly the HOD's permissions — so filtering on the
      // enum literal made a department led by one of them read "Awaiting an HOD"
      // while its head was approving that department's visitors all day. The
      // roster still prints each person's OWN role name; it is the permission
      // that is shared, never the job title.
      .in('role', [...HOD_ROLES])
      .order('full_name');
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setHods(data ?? []);
    }
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

  return { hods, loading, error, reload: load };
}
