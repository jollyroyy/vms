-- 015 — Remove user_metadata fallback from all RPCs (SEC-8).
-- user_metadata is editable by the end user via auth.updateUser() and
-- must never be trusted for role/department_id. All users have app_metadata
-- after migration 010 backfilled existing users.
-- Also fixes clear_pre_approved() to scope by department (SEC-9).

-- 1) clear_pre_approved — add department scoping, remove user_metadata fallback
create or replace function public.clear_pre_approved()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_jwt_role text;
  v_dept_id uuid;
begin
  v_jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
  v_dept_id := (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid;
  if v_jwt_role not in ('guard', 'hod', 'admin', 'super_admin') then
    raise exception 'Only Guard, HOD, or Admin can clear pre-approvals.';
  end if;
  if v_jwt_role in ('guard', 'hod') and v_dept_id is null then
    raise exception 'Your account is not assigned to any department.';
  end if;
  if v_jwt_role = 'admin' or v_jwt_role = 'super_admin' then
    update public.visits set status = 'rejected', rejection_reason = 'Cleared by ' || v_jwt_role
    where status = 'approved';
  else
    update public.visits set status = 'rejected', rejection_reason = 'Cleared by ' || v_jwt_role
    where status = 'approved' and department_id = v_dept_id;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2) approve_visit — remove user_metadata fallback
create or replace function public.approve_visit(visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
  jwt_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  hod_dept := (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid;
  if jwt_role not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can approve visits.';
  end if;
  if jwt_role = 'hod' and hod_dept is null then
    raise exception 'Your account is not assigned to any department.';
  end if;
  select department_id into visit_dept from public.visits where id = visit_id;
  if visit_dept is null then
    raise exception 'Visit not found.';
  end if;
  if jwt_role = 'hod' and hod_dept <> visit_dept then
    raise exception 'You can only approve visits in your own department.';
  end if;
  update public.visits set status = 'walkin_approved', rejection_reason = null where id = visit_id;
end;
$$;

-- 3) reject_visit — remove user_metadata fallback
create or replace function public.reject_visit(visit_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
  jwt_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if reason is null or trim(reason) = '' then
    raise exception 'Rejection reason is required.';
  end if;
  hod_dept := (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid;
  if jwt_role not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can reject visits.';
  end if;
  if jwt_role = 'hod' and hod_dept is null then
    raise exception 'Your account is not assigned to any department.';
  end if;
  select department_id into visit_dept from public.visits where id = visit_id;
  if visit_dept is null then
    raise exception 'Visit not found.';
  end if;
  if jwt_role = 'hod' and hod_dept <> visit_dept then
    raise exception 'You can only reject visits in your own department.';
  end if;
  update public.visits set status = 'rejected', rejection_reason = trim(reason) where id = visit_id;
end;
$$;

-- 4) enforce_visit_update_rules trigger — remove user_metadata fallback
create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql as $$
declare
  jwt_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if public.is_service_role() then return new; end if;
  new.ref_number := old.ref_number;
  new.created_at := old.created_at;
  if new.checked_in_at is distinct from old.checked_in_at and new.checked_in_at is not null then
    new.checked_in_at := now();
  end if;
  if new.checked_out_at is distinct from old.checked_out_at and new.checked_out_at is not null then
    new.checked_out_at := now();
  end if;
  if new.status is distinct from old.status then
    if old.status = 'pending_approval' and new.status in ('approved','rejected') then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can decide approvals.';
      end if;
    elsif old.status = 'pending_approval' and new.status = 'walkin_approved' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can approve walk-in visitors.';
      end if;
    elsif old.status in ('approved','walkin_approved') and new.status = 'checked_in' then
      if jwt_role not in ('guard','admin','super_admin') then
        raise exception 'Only the guard can log check-in.';
      end if;
    elsif old.status in ('approved','walkin_approved') and new.status = 'rejected' then
      if jwt_role not in ('guard','hod','admin','super_admin') then
        raise exception 'Only Guard, HOD, or Admin can clear visitors.';
      end if;
    elsif old.status = 'checked_in' and new.status = 'checked_out' then
      if jwt_role not in ('guard','admin','super_admin') then
        raise exception 'Only the guard can log check-out.';
      end if;
    else
      raise exception 'Invalid status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;
