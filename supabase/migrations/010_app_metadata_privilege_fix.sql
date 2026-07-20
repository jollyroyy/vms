-- 010 — Privilege-escalation fix (advisor: rls_references_user_metadata, ERROR).
-- user_metadata is editable by the end user via auth.updateUser() — a staff user
-- could set role='admin' and forge their own JWT claims. Role and department now
-- live in app_metadata, which only the service role can write.

-- 1) Sync trigger writes app_metadata (was user_metadata)
create or replace function public.sync_profile_role_to_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', new.role, 'department_id', new.department_id),
      raw_user_meta_data = (coalesce(raw_user_meta_data, '{}'::jsonb) - 'role') - 'department_id'
  where id = new.id;
  return new;
end;
$$;

-- 2) New-user trigger: default role into app_metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'staff')
  where id = new.id;
  return new;
end;
$$;

-- 3) Backfill every existing user; scrub forgeable user_metadata copies
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role, 'department_id', p.department_id),
    raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'role') - 'department_id'
from public.profiles p
where p.id = u.id;

-- 4) Role helper reads app_metadata
create or replace function public.current_user_role()
returns public.user_role language sql stable set search_path = '' as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role')::public.user_role;
$$;

-- 5) Recreate every policy that read user_metadata, now on app_metadata
drop policy if exists "visits: read scoped by role" on public.visits;
create policy "visits: read scoped by role"
  on public.visits for select to authenticated
  using (
    public.current_user_role() in ('guard','admin','super_admin')
    or department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
  );

drop policy if exists "visits: hod pre-approves own department" on public.visits;
create policy "visits: hod pre-approves own department"
  on public.visits for insert to authenticated
  with check (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
    and status = 'approved'
  );

drop policy if exists "gate_passes: hod approves own department" on public.gate_passes;
create policy "gate_passes: hod approves own department"
  on public.gate_passes for update to authenticated
  using (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
  )
  with check (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
  );

drop policy if exists "gate_passes: insert scoped by role" on public.gate_passes;
create policy "gate_passes: insert scoped by role"
  on public.gate_passes for insert to authenticated
  with check (
    public.current_user_role() in ('guard','admin','super_admin')
    or (
      public.current_user_role() in ('staff','hod')
      and department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
    )
  );

-- 6) Approve/reject RPCs read app_metadata (admin no longer needs a department)
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
  update public.visits set status = 'approved', rejection_reason = null where id = visit_id;
end;
$$;

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

-- 7) State-machine trigger reads app_metadata
create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
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
    elsif old.status = 'approved' and new.status = 'checked_in' then
      if jwt_role not in ('guard','admin','super_admin') then
        raise exception 'Only the guard can log check-in.';
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

-- 8) Hardening: anon has no business executing these (advisors 0028/0029)
revoke execute on function public.approve_visit(uuid) from anon;
revoke execute on function public.reject_visit(uuid, text) from anon;
revoke execute on function public.get_profile_names(uuid[]) from anon;
revoke execute on function public.current_user_role() from anon;
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.sync_profile_role_to_auth() from anon, authenticated;
revoke all on function public.notify_hod_on_visit() from anon, authenticated;
revoke all on function public.notify_guard_on_decision() from anon, authenticated;
revoke all on function public.generate_visit_ref() from anon, authenticated;
revoke all on function public.generate_gate_pass_ref() from anon, authenticated;
revoke all on function public.enforce_visit_update_rules() from anon, authenticated;
revoke all on function public.enforce_gate_pass_update_rules() from anon, authenticated;
revoke all on function public.is_service_role() from anon;
