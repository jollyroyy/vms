-- Replace the HOD approve/reject RLS policy with a security-definer RPC.
-- The RLS policy's `current_user_role()` call triggers infinite recursion on PG15+
-- even when reading department_id from JWT. This RPC bypasses RLS entirely.
--
-- Usage from frontend:
--   supabase.rpc('approve_visit', { visit_id: '...' })
--   supabase.rpc('reject_visit',  { visit_id: '...', reason: '...' })

-- Drop the problematic HOD policy entirely.
drop policy if exists "visits: hod approves own department" on public.visits;

-- Approve: HOD marks visit as approved
create or replace function public.approve_visit(visit_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
begin
  -- Get HOD's department from JWT (no RLS)
  hod_dept := (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid;
  if hod_dept is null then
    raise exception 'Your account is not assigned to any department.';
  end if;

  -- Verify the user is a HOD
  if (auth.jwt() -> 'user_metadata' ->> 'role') not in ('hod', 'admin', 'super_admin') then
    raise exception 'Only HOD or Admin can approve visits.';
  end if;

  -- Get the visit's department
  select department_id into visit_dept from public.visits where id = visit_id;
  if visit_dept is null then
    raise exception 'Visit not found.';
  end if;

  -- Verify HOD matches the visit's department
  if hod_dept <> visit_dept and (auth.jwt() -> 'user_metadata' ->> 'role') not in ('admin', 'super_admin') then
    raise exception 'You can only approve visits in your own department.';
  end if;

  update public.visits set status = 'approved', rejection_reason = null where id = visit_id;
end;
$$;

-- Reject: HOD rejects a visit with a reason
create or replace function public.reject_visit(visit_id uuid, reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
begin
  if reason is null or trim(reason) = '' then
    raise exception 'Rejection reason is required.';
  end if;

  hod_dept := (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid;
  if hod_dept is null then
    raise exception 'Your account is not assigned to any department.';
  end if;

  if (auth.jwt() -> 'user_metadata' ->> 'role') not in ('hod', 'admin', 'super_admin') then
    raise exception 'Only HOD or Admin can reject visits.';
  end if;

  select department_id into visit_dept from public.visits where id = visit_id;
  if visit_dept is null then
    raise exception 'Visit not found.';
  end if;

  if hod_dept <> visit_dept and (auth.jwt() -> 'user_metadata' ->> 'role') not in ('admin', 'super_admin') then
    raise exception 'You can only reject visits in your own department.';
  end if;

  update public.visits set status = 'rejected', rejection_reason = trim(reason) where id = visit_id;
end;
$$;
