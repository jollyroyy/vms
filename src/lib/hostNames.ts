import { supabase } from '../supabaseClient';

interface HostRecord { id: string; full_name: string; }
type HasHostId = { host_id: string; host?: { id: string; full_name: string } | null };

/** Fetch host names via security-definer RPC (bypasses RLS recursion on profiles). */
export async function attachHostNames<T extends HasHostId>(rows: T[]): Promise<T[]> {
  const hostIds = [...new Set(rows.map((r) => r.host_id).filter(Boolean))] as string[];
  if (hostIds.length === 0) { return rows; }

  const { data, error } = await (supabase as any).rpc('get_profile_names', { profile_ids: hostIds });
  if (error || !data) {
    console.error('[hostNames] RPC error:', error?.message);
    return rows;
  }
  const map = new Map((data as HostRecord[]).map((h) => [h.id, h]));
  return rows.map((r) => ({ ...r, host: map.get(r.host_id) ?? null }));
}
