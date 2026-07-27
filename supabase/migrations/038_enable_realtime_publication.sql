-- 038 — Actually enable Supabase Realtime for the tables the app subscribes to.
--
-- BUG: every page opens a `postgres_changes` channel (10 subscriptions on `visits`,
-- 2 on `notifications`, 2 on `gate_passes`), but the `supabase_realtime` publication
-- contained ONLY `gatepass.gate_passes`. No public table was published, so Postgres
-- never emitted a single change event and every one of those subscriptions was dead.
-- Symptom: dashboards, the HOD overview KPIs and the guard console only refreshed on a
-- manual page reload — new visits and pre-approvals appeared to lag indefinitely.
--
-- FIX part 1 — publish the three tables the client actually listens to.
--
-- FIX part 2 — REPLICA IDENTITY FULL. The client filters server-side on
--   visits.department_id  and  notifications.recipient_id
-- Both are NON-primary-key columns. With the default replica identity Postgres only
-- puts the PK in the WAL for UPDATE/DELETE, so Realtime cannot evaluate a filter on
-- those columns and silently drops the event. FULL puts the whole old row in the WAL,
-- which is what makes `filter: department_id=eq.<uuid>` work for updates and deletes
-- (an approval is an UPDATE, so without this the approve/reject flow stays stale).
-- Cost is extra WAL volume per write; these tables are low-write, so it is the right
-- trade for correctness.
--
-- Realtime still honours RLS: a subscriber only receives rows its policies allow.

-- Idempotent publication membership.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits'
  ) then
    alter publication supabase_realtime add table public.visits;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gate_passes'
  ) then
    alter publication supabase_realtime add table public.gate_passes;
  end if;
end $$;

alter table public.visits         replica identity full;
alter table public.notifications  replica identity full;
alter table public.gate_passes    replica identity full;
