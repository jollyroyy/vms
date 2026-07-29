import { supabase } from '../supabaseClient';

export type VisitActor = { name: string; role: string };
type HasId = { id: string; status: string };

const ACTIONABLE_STATUSES = new Set(['walkin_approved', 'rejected']);

/** Attach the actor (name + role) who last approved/rejected each visit, via audit_logs. */
export async function attachVisitActors<T extends HasId>(
  visits: T[],
): Promise<(T & { actor?: VisitActor | null })[]> {
  const ids = visits.filter((v) => ACTIONABLE_STATUSES.has(v.status)).map((v) => v.id);
  if (ids.length === 0) { return visits; }

  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('user_id, entity_id, created_at')
    .eq('entity_type', 'visit')
    .in('entity_id', ids)
    .in('action', ['visit_approved', 'visit_rejected'])
    .order('created_at', { ascending: false });
  if (error || !logs || logs.length === 0) { return visits; }

  const latestByVisit = new Map<string, string | null>();
  for (const log of logs as { user_id: string | null; entity_id: string }[]) {
    if (!latestByVisit.has(log.entity_id)) { latestByVisit.set(log.entity_id, log.user_id); }
  }

  const userIds = [...new Set([...latestByVisit.values()].filter(Boolean))] as string[];
  const profileMap = new Map<string, VisitActor>();
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase as any).rpc('get_profile_names', { profile_ids: userIds });
    for (const p of (profiles ?? []) as { id: string; full_name: string; role: string }[]) {
      profileMap.set(p.id, { name: p.full_name, role: p.role });
    }
  }

  return visits.map((v) => {
    const userId = latestByVisit.get(v.id);
    return { ...v, actor: userId ? (profileMap.get(userId) ?? null) : null };
  });
}
