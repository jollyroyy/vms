-- 039 — Enable Supabase Realtime for `departments` and `profiles`.
--
-- WHY: the Admin Panel is where departments are created/renamed/deleted and where
-- HODs get assigned to a department (via `profiles`). Every other screen — guard
-- console, guard/visitor forms, walk-in requests, HOD pre-approve form, and the
-- kiosk — reads that same department list to populate its picker or to resolve a
-- host's department/HOD. Without realtime on these two tables, an admin's change
-- only reaches those screens after a manual reload, so a guard could keep offering
-- a department the admin just deleted, or a stale HOD, for an indefinite window.
--
-- FIX part 1 — publish `public.departments` and `public.profiles` so postgres_changes
-- subscribers (see src/lib/useDepartments.ts) actually receive events for them.
--
-- FIX part 2 — REPLICA IDENTITY FULL, matching the pattern established in migration
-- 038 for visits/notifications/gate_passes. Consumers may filter or diff on non-PK
-- columns (e.g. a department's `name`, or a profile's `department_id`/`role`), and
-- the default replica identity only ships the PK for UPDATE/DELETE, which silently
-- drops those fields from the change payload. FULL puts the whole old row in the
-- WAL so updates/deletes carry complete before-and-after data. Both tables are
-- low-write, so the extra WAL volume is the right trade for correctness.
--
-- Realtime still honours RLS: a subscriber only receives rows its policies allow.

-- Idempotent publication membership.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'departments'
  ) then
    alter publication supabase_realtime add table public.departments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

alter table public.departments replica identity full;
alter table public.profiles    replica identity full;
