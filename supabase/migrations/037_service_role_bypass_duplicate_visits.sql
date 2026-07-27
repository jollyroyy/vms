-- 037 — Let the service role bypass the duplicate-active-visit guard
--
-- SEC-17 (migration 017, re-applied in 019) forbids a visitor from having more
-- than one active visit at a time, bypassing only for app roles admin/super_admin.
-- That check reads `auth.jwt() -> 'app_metadata' ->> 'role'`, which is NULL for the
-- service-role key: the service role carries a top-level `role` claim of
-- 'service_role' and has no app_metadata. So trusted server-side callers were
-- being blocked by a rule that only ever targeted end users:
--   * scripts/seed.ts could not seed multiple visits for a demo visitor
--   * tests/security/rls.test.ts could not build its fixtures in beforeAll
--
-- The service-role key already bypasses RLS entirely and is never bundled into the
-- client (see .env.example), so honouring it here is consistent with how it is
-- already trusted everywhere else. Direct SQL with no JWT at all (auth.jwt() is
-- NULL, e.g. psql/migrations) is likewise treated as a trusted server context.
--
-- The end-user rule is UNCHANGED: guard/hod/staff still cannot create a second
-- active visit for the same visitor.

create or replace function public.prevent_duplicate_active_visits()
returns trigger language plpgsql as $$
declare
  claims    jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_role  text  := claims -> 'app_metadata' ->> 'role';
  auth_role text  := claims ->> 'role';
begin
  -- Trusted server contexts: service role, or no JWT at all (direct SQL).
  if claims is null or auth_role = 'service_role' then
    return new;
  end if;

  -- Existing app-role bypass, unchanged.
  if jwt_role in ('admin', 'super_admin') then
    return new;
  end if;

  if public.check_active_visit_exists(new.visitor_id) then
    raise exception 'This visitor already has an active visit. Please complete the existing visit before creating a new one.';
  end if;

  return new;
end;
$$;

-- Trigger binding is unchanged; recreate defensively so this migration is
-- self-contained if applied to a database where 017/019 ran in either order.
drop trigger if exists check_duplicate_visit_trigger on public.visits;
create trigger check_duplicate_visit_trigger
  before insert on public.visits
  for each row execute function public.prevent_duplicate_active_visits();
