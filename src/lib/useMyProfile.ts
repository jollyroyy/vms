// The signed-in user's own profile row, plus the two edits they are allowed to
// make: display name and photo.
//
// Only `full_name` and `avatar_url` are ever written. `role`, `department_id`
// and `delegate_id` are administered from the Admin Panel — role in particular
// syncs into the JWT via the sync_profile_role_to_auth trigger (migration 010),
// so it must never be reachable from a self-service form.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Profile } from '../types/index';

export type UseMyProfile = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  saveName: (fullName: string) => Promise<string | null>;
  setAvatarUrl: (url: string | null) => void;
};

export function useMyProfile(userId: string): UseMyProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (err) setError(err.message);
    else {
      setError(null);
      setProfile((data as Profile | null) ?? null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  /** Returns an error message, or null on success. */
  const saveName = useCallback(async (fullName: string): Promise<string | null> => {
    const trimmed = fullName.trim();
    if (trimmed.length === 0) return 'Your name cannot be empty.';
    if (trimmed.length > 80) return 'Please keep your name under 80 characters.';

    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: trimmed } as never)
      .eq('id', userId);

    if (err) return err.message || 'Could not save your name.';
    setProfile((p) => (p ? { ...p, full_name: trimmed } : p));
    return null;
  }, [userId]);

  const setAvatarUrl = useCallback((url: string | null) => {
    setProfile((p) => (p ? { ...p, avatar_url: url } : p));
  }, []);

  return { profile, loading, error, saveName, setAvatarUrl };
}
