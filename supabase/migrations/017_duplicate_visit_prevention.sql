-- 017 — Prevent duplicate active visits for the same visitor on the same day
-- SEC-17: A visitor (identified by phone) may only have one active visit at a time.
-- Active statuses: pending_approval, approved, walkin_approved, checked_in

-- 1) Helper: check if a visitor already has an active visit
create or replace function public.check_active_visit_exists(p_visitor_id uuid)
returns boolean language plpgsql stable as $$
begin
  return exists (
    select 1 from public.visits
    where visitor_id = p_visitor_id
      and status in ('pending_approval', 'approved', 'walkin_approved', 'checked_in')
  );
end;
$$;

-- 2) Trigger function: prevent insert if visitor has an active visit (allow admin bypass)
create or replace function public.prevent_duplicate_active_visits()
returns trigger language plpgsql as $$
declare
  jwt_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if jwt_role in ('admin', 'super_admin') then
    return new;
  end if;
  if public.check_active_visit_exists(new.visitor_id) then
    raise exception 'This visitor already has an active visit. Please complete the existing visit before creating a new one.';
  end if;
  return new;
end;
$$;

-- 3) Attach trigger before insert on visits
drop trigger if exists check_duplicate_visit_trigger on public.visits;
create trigger check_duplicate_visit_trigger
  before insert on public.visits
  for each row execute function public.prevent_duplicate_active_visits();

-- 4) RPC: get active visit for a given phone number (client-side pre-check)
create or replace function public.get_active_visit_for_phone(p_phone text)
returns table (
  id          uuid,
  status      public.visit_status,
  ref_number  text,
  created_at  timestamptz
) language plpgsql security definer set search_path = '' as $$
declare
  v_visitor_id uuid;
begin
  select id into v_visitor_id from public.visitors where phone = p_phone;
  if v_visitor_id is null then
    return;
  end if;
  return query
  select v.id, v.status, v.ref_number, v.created_at
  from public.visits v
  where v.visitor_id = v_visitor_id
    and v.status in ('pending_approval', 'approved', 'walkin_approved', 'checked_in')
  order by v.created_at desc
  limit 1;
end;
$$;

-- 5) Permissions
grant execute on function public.check_active_visit_exists(uuid) to authenticated;
grant execute on function public.get_active_visit_for_phone(text) to authenticated;
revoke execute on function public.check_active_visit_exists(uuid) from anon;
revoke execute on function public.get_active_visit_for_phone(text) from anon;
revoke all on function public.prevent_duplicate_active_visits() from anon, authenticated;
