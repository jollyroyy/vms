-- 059_visitor_vendor_name.sql
--
-- The organisation calls the party a visitor arrives on behalf of a *vendor*,
-- not a *company*. Rename the columns and the RPC parameter so the schema uses
-- the business's own vocabulary and the UI labels stop diverging from it.
--
--   visitors.company                 -> visitors.vendor_name
--   recurring_visits.visitor_company -> recurring_visits.visitor_vendor_name
--
-- Deliberately NOT renamed: gate_passes.company_name. That belongs to the
-- material-movement (RGP/NRGP) module, describes the carrier company on a gate
-- pass and has nothing to do with a visitor. See CLAUDE.md.
--
-- Verified against the live project before writing: no index, RLS policy or
-- view references either column, so the rename cannot orphan a dependency. The
-- only dependants are the two pre-approval RPCs recreated below.

alter table public.visitors
  rename column company to vendor_name;

alter table public.recurring_visits
  rename column visitor_company to visitor_vendor_name;

-- Postgres refuses to rename an input parameter via CREATE OR REPLACE, so the
-- functions have to be dropped and recreated. Both bodies are reproduced from
-- the live definitions unchanged apart from company -> vendor_name; the whole
-- point of this migration is that behaviour does not move.
drop function if exists public.pre_approve_visitor(text, text, text, uuid, uuid, text, timestamptz);
drop function if exists public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz);

create function public.pre_approve_visitor(
  p_phone text,
  p_full_name text,
  p_vendor_name text,
  p_department_id uuid,
  p_host_id uuid,
  p_purpose text,
  p_scheduled_for timestamptz default null
) returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_visitor_id uuid;
  v_ref text;
  v_jwt_role text;
  v_jwt_dept_id uuid;
begin
  v_jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
  if v_jwt_role not in ('hod', 'admin', 'super_admin') then
    raise exception 'Only HOD or Admin can pre-approve visitors.';
  end if;

  if v_jwt_role = 'hod' then
    v_jwt_dept_id := (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid;
    if v_jwt_dept_id is null or v_jwt_dept_id <> p_department_id then
      raise exception 'You can only pre-approve visitors for your own department.';
    end if;
  end if;

  insert into public.visitors (phone, full_name, vendor_name)
  values (p_phone, p_full_name, nullif(p_vendor_name, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    vendor_name = coalesce(nullif(p_vendor_name, ''), visitors.vendor_name)
  returning id into v_visitor_id;

  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material, scheduled_for, qr_expires_at
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved', false, p_scheduled_for,
    coalesce(p_scheduled_for, now()) + interval '24 hours'
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

create function public.pre_approve_visitor_v2(
  p_phone text,
  p_full_name text,
  p_vendor_name text,
  p_department_id uuid,
  p_host_id uuid,
  p_purpose text,
  p_scheduled_for timestamptz default null
) returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_visitor_id uuid;
  v_ref text;
begin
  insert into public.visitors (phone, full_name, vendor_name)
  values (p_phone, p_full_name, nullif(p_vendor_name, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    vendor_name = coalesce(nullif(p_vendor_name, ''), visitors.vendor_name)
  returning id into v_visitor_id;

  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material, scheduled_for
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved',
    false, p_scheduled_for
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

-- Restore the exact grants the dropped functions carried. `anon` keeps execute
-- on pre_approve_visitor only because it already had it; the function's own JWT
-- role check rejects an anonymous caller before it touches a row.
revoke all on function public.pre_approve_visitor(text, text, text, uuid, uuid, text, timestamptz) from public;
grant execute on function public.pre_approve_visitor(text, text, text, uuid, uuid, text, timestamptz)
  to anon, authenticated, service_role;

revoke all on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz) from public;
grant execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz)
  to authenticated, service_role;
