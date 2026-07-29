// Live department list, shared by every screen that shows or picks a department.
// Subscribes to postgres_changes on `departments`, so an admin adding, renaming or
// deleting a department reaches guards, HODs, staff and the kiosk immediately —
// no reload. Requires `departments` in the supabase_realtime publication
// (supabase/migrations/039_realtime_departments_profiles.sql).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Department } from '../types/index';

export type UseDepartments = {
  departments: Department[];
  loading: boolean;
  reload: () => Promise<void>;
};

export function useDepartments(): UseDepartments {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel('departments-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
        void load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { departments, loading, reload: load };
}
