-- 021 — Vehicle number, consent, emergency contact, expected duration fields
-- Addresses gaps found during form validation + visitor policy audits.

alter table public.visitors add column if not exists vehicle_number text;

alter table public.visits add column if not exists emergency_contact_name text;
alter table public.visits add column if not exists emergency_contact_phone text;
alter table public.visits add column if not exists expected_duration_minutes int;
alter table public.visits add column if not exists consent_privacy boolean not null default false;
alter table public.visits add column if not exists consent_site_rules boolean not null default false;
alter table public.visits add column if not exists nda_signature text;
alter table public.visits add column if not exists privacy_signature text;
alter table public.visits add column if not exists site_rules_signature text;

-- Update pre_approve_visitor RPC to include vehicle_number
drop function if exists public.pre_approve_visitor;
create or replace function public.pre_approve_visitor(
  p_phone text,
  p_full_name text,
  p_company text,
  p_vehicle_number text,
  p_department_id uuid,
  p_host_id uuid,
  p_purpose text
)
returns json
language plpgsql
security definer
set search_path = ''
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

  insert into public.visitors (phone, full_name, company, vehicle_number)
  values (p_phone, p_full_name, nullif(p_company, ''), nullif(p_vehicle_number, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    company = coalesce(nullif(p_company, ''), visitors.company),
    vehicle_number = coalesce(nullif(p_vehicle_number, ''), visitors.vehicle_number)
  returning id into v_visitor_id;

  insert into public.visits (visitor_id, department_id, host_id, purpose, status, carrying_material)
  values (v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose, 'approved', false)
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

revoke execute on function public.pre_approve_visitor(text, text, text, text, uuid, uuid, text) from anon;
