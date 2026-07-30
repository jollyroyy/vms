-- 054 — DRIFT RECONCILIATION 9/10: realtime for departments + profiles (from 039).
--
-- LIVE BUG, and it silently contradicts a documented guarantee. CLAUDE.md
-- states: "Both tables are in the `supabase_realtime` publication with
-- `replica identity full` (migration 039)". The live publication actually
-- contains only public.visits, public.gate_passes, public.notifications
-- (from 038, which WAS applied) plus a stray gatepass.gate_passes.
-- public.departments and public.profiles are absent, and both still have
-- replica identity 'd' (default) rather than 'f' (full).
--
-- Consequence today: src/lib/useDepartments.ts and src/lib/useHods.ts do
-- subscribe to postgres_changes, but Postgres never publishes those changes, so
-- the subscriptions never fire. An admin renaming or deleting a department, or
-- reassigning an HOD, does NOT propagate to the guard console, visitor forms,
-- walk-in request, HOD pre-approve form or the kiosk until each client is
-- manually reloaded — exactly the stale-picker window 039 was written to close.
--
-- Realtime still honours RLS: a subscriber only receives rows its policies allow.

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

-- FULL puts the whole old row in the WAL, so UPDATE/DELETE payloads carry
-- non-PK columns (a department's `name`, a profile's `role`/`department_id`).
-- The default identity ships only the PK and silently drops them.
alter table public.departments replica identity full;
alter table public.profiles    replica identity full;
