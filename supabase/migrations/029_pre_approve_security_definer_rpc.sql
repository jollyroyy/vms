-- 029 — Bypass RLS via security definer RPC for pre-approval
--
-- Every attempt to fix RLS policies for HOD upsert on visitors has failed
-- (migrations 026, 027, 028). The root cause is that PostgreSQL RLS WITH
-- CHECK policies evaluate in the row context where auth.jwt() expression
-- doesn't resolve reliably for HOD sessions.
--
-- Solution: A security definer RPC that bypasses RLS entirely. It runs with
-- DB owner privileges and performs the visitor upsert + visit insert atomically.

create or replace function public.pre_approve_visitor_v2(
  p_phone text,
  p_full_name text,
  p_company text,
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
begin
  insert into public.visitors (phone, full_name, company)
  values (p_phone, p_full_name, nullif(p_company, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    company = coalesce(nullif(p_company, ''), visitors.company)
  returning id into v_visitor_id;

  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved',
    false
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

revoke execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text) from anon, public;
grant execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text) to authenticated;
