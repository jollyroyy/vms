-- 025 — Security-definer RPC to fetch hosts (profiles) by department_id.
-- Bypasses RLS on profiles so Guard, Kiosk, and HOD PreApproveForm can
-- populate the "Person to Meet" dropdown regardless of the caller's role.
-- Follows the same pattern as 005_rpc_get_profile_names.sql.

create or replace function public.get_hosts_for_department(dept_id uuid)
returns table (id uuid, full_name text, email text, role public.user_role)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select p.id, p.full_name, p.email, p.role
    from public.profiles p
    where p.department_id = dept_id
    order by p.full_name;
end;
$$;
