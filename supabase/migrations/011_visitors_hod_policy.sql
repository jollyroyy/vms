-- 011 — Pre-approve visitor via security-definer RPC (bypasses RLS).
-- Instead of opening visitors RLS to HOD (which widens attack surface), this RPC
-- upserts the visitor AND creates the pre-approved visit in one atomic transaction
-- using SECURITY DEFINER. Same pattern as approve_visit / reject_visit in 010.

create or replace function public.pre_approve_visitor(
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
  v_jwt_role text;
  v_jwt_dept_id uuid;
begin
  -- Only HOD / Admin / SuperAdmin may pre-approve
  v_jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
  if v_jwt_role not in ('hod', 'admin', 'super_admin') then
    raise exception 'Only HOD or Admin can pre-approve visitors.';
  end if;

  -- HOD is scoped to their own department
  if v_jwt_role = 'hod' then
    v_jwt_dept_id := (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid;
    if v_jwt_dept_id is null or v_jwt_dept_id <> p_department_id then
      raise exception 'You can only pre-approve visitors for your own department.';
    end if;
  end if;

  -- Upsert visitor (bypasses RLS via security definer)
  insert into public.visitors (phone, full_name, company)
  values (p_phone, p_full_name, nullif(p_company, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    company = coalesce(nullif(p_company, ''), visitors.company)
  returning id into v_visitor_id;

  -- Create pre-approved visit
  insert into public.visits (visitor_id, department_id, host_id, purpose, status, carrying_material)
  values (v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose, 'approved', false)
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

-- Only authenticated (anon gets 401 / permission denied)
revoke execute on function public.pre_approve_visitor(text, text, text, uuid, uuid, text) from anon;
