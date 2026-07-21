-- 014 — Add walkin_approved status to distinguish on-the-fly approvals from pre-approvals.
-- Pre-approved visitors: status = 'approved' (via pre_approve_visitor RPC)
-- Walk-in approved visitors: status = 'walkin_approved' (via approve_visit RPC after guard registration)
-- This lets the UI show them in separate tabs.

alter type public.visit_status add value 'walkin_approved' before 'checked_in';

-- Update approve_visit: mark walk-in approvals as walkin_approved (not plain approved)
create or replace function public.approve_visit(visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');
begin
  hod_dept := coalesce((auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid, (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid);
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

-- Update state machine trigger to allow walkin_approved transitions
create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql as $$
declare
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');
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
