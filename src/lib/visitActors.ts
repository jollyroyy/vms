import { supabase } from '../supabaseClient';

export type VisitActor = { name: string; role: string };
type HasId = { id: string; status: string };

export type VisitActorFields = {
  /** Who took the most recent approve/reject decision. */
  actor?: VisitActor | null;
  /** When that most recent decision was taken. */
  actorAt?: string | null;
  /** When the visit was approved, specifically — null if the only decision was a rejection. */
  approvedAt?: string | null;
};

// Every status except `pending_approval` means a decision was already taken, so
// every one of them can carry an audit trail worth showing. This deliberately
// includes `checked_in`/`checked_out`: the reports register has to state the
// exact approval time for visits that have since moved on, and that timestamp
// only exists in audit_logs.
const DECIDED_STATUSES = new Set([
  'approved', 'walkin_approved', 'checked_in', 'checked_out',
  'rejected', 'cancelled', 'no_show',
]);

type AuditRow = { user_id: string | null; entity_id: string; action: string; created_at: string };

/** Attach the actor (name + role) and timestamps of the approve/reject actions recorded against each visit. */
export async function attachVisitActors<T extends HasId>(
  visits: T[],
): Promise<(T & VisitActorFields)[]> {
  const ids = visits.filter((v) => DECIDED_STATUSES.has(v.status)).map((v) => v.id);
  if (ids.length === 0) { return visits; }

  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('user_id, entity_id, action, created_at')
    .eq('entity_type', 'visit')
    .in('entity_id', ids)
    .in('action', ['visit_approved', 'visit_rejected'])
    .order('created_at', { ascending: false });
  if (error || !logs || logs.length === 0) { return visits; }

  // Rows arrive newest-first, so the first sighting of a visit id is its latest
  // decision. The approval map is kept separate because a rejection that came
  // *after* an approval must not overwrite the approval's timestamp.
  const latestByVisit = new Map<string, { userId: string | null; createdAt: string }>();
  const approvedAtByVisit = new Map<string, string>();
  for (const log of logs as AuditRow[]) {
    if (!latestByVisit.has(log.entity_id)) {
      latestByVisit.set(log.entity_id, { userId: log.user_id, createdAt: log.created_at });
    }
    if (log.action === 'visit_approved' && !approvedAtByVisit.has(log.entity_id)) {
      approvedAtByVisit.set(log.entity_id, log.created_at);
    }
  }

  const userIds = [...new Set([...latestByVisit.values()].map((v) => v.userId).filter(Boolean))] as string[];
  const profileMap = new Map<string, VisitActor>();
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase as any).rpc('get_profile_names', { profile_ids: userIds });
    for (const p of (profiles ?? []) as { id: string; full_name: string; role: string }[]) {
      profileMap.set(p.id, { name: p.full_name, role: p.role });
    }
  }

  return visits.map((v) => {
    const entry = latestByVisit.get(v.id);
    return {
      ...v,
      actor: entry?.userId ? (profileMap.get(entry.userId) ?? null) : null,
      actorAt: entry?.createdAt ?? null,
      approvedAt: approvedAtByVisit.get(v.id) ?? null,
    };
  });
}
