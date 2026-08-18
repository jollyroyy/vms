-- 100 — EVERY ACCOUNT THAT IS NOT A GUARD AND NOT AN ADMIN IS AN HOD
-- (client instruction, 2026-08-18). `senior_manager` was given an HOD's
-- permissions by 099; `staff` gets them here, which is the substance of the
-- instruction: a staff member is what a HOST is in this system
-- (`get_hosts_for_department` returns the staff and HODs of a department), and
-- a host who cannot raise a pre-approval for their own visitor has to ask
-- somebody else to invite them.
--
-- 099 SAID "ONE EDIT, NOT TWELVE", AND IT WAS ONE EDIT SHORT. Teaching
-- `current_user_role()` to answer `hod` does carry every policy written against
-- that function — but several objects in this schema never call it. They read
-- the JWT claim directly:
--
--   approve_visit, reject_visit, cancel_visit, cancel_all_pre_approved,
--   clear_pre_approved, enforce_visit_update_rules   (SECURITY DEFINER bodies)
--   visitors: guard/hod/admin can insert / can update, and the three
--   recurring_visits policies                        (raw auth.jwt() in the
--                                                     policy expression)
--
-- Which means a senior manager has been unable to approve or decline a walk-in
-- since 098/099 shipped — the console offers the button and Postgres raises
-- "Only HOD or Admin can approve visits." That is fixed here as well, by the
-- same edit, because both roles now resolve through ONE function.
--
-- `public.effective_role()` is that function: the JWT role with the approver
-- roles folded onto `hod`. Every body below is the LIVE text as read from
-- `pg_get_functiondef` on 2026-08-18 with the role expression swapped for a
-- call to it and NOTHING else changed. Diff before and after (memory SB-15).
--
-- IT READS `app_metadata` ONLY. Three of these bodies coalesced a
-- `user_metadata` fallback, which SEC-8 (migration 022) deliberately removed
-- from `current_user_role()` — `user_metadata` is writable by the user it
-- describes, so a role read from there is a role the holder chose. Migration
-- 010's trigger mirrors `profiles.role` into `app_metadata` for every account,
-- and every policy on `visits` has read that copy alone since, so a session
-- lacking it cannot see a visit to act on in the first place.
--
-- WHAT THIS DOES NOT DO: it does not hide who acted. `profiles.role` still
-- stores `staff`, the JWT still carries it (that is what picks the sidebar and
-- the landing page), Settings → Users still prints it, and every audit row is
-- stamped with `auth.uid()`. The mapping is about PERMISSION.
--
-- `ceo` is deliberately NOT in the mapping. That role is the second pair of
-- eyes on an admin's blacklist-removal request; giving it the desk it audits
-- would collapse the two people migration 091 exists to require into one. It is
-- also refused by admin_create_user, so "whatever user has been created" never
-- produces one.
--
-- `CREATE OR REPLACE`, never DROP: these are referenced by a trigger and by the
-- app's RPC calls, and a DROP resets the ACL as well as taking dependents with
-- it. Apply 100 and then 101 — the second half is the trigger, the policies and
-- the notification fan-out, split only by this project's 300-line cap.

-- ── The one mapping ─────────────────────────────────────────────────────────
create or replace function public.effective_role()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case when r in ('hod', 'senior_manager', 'staff') then 'hod' else r end
  from (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') as r) t;
$function$;

comment on function public.effective_role() is
  'JWT role with every approver role (hod, senior_manager, staff) folded onto hod. PERMISSION only: profiles.role still stores the real role and audit rows still stamp auth.uid(). Mirrors src/lib/hodRoles.ts — keep the two in step.';

-- ── current_user_role(): 099's live body, one member added to the mapping ───
-- The suspension gate stays FIRST (094), so no amount of role mapping can hand
-- a withdrawn account a permission.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path to ''
as $function$
  select case
           when not public.is_user_active(auth.uid()) then null
           when (auth.jwt() -> 'app_metadata' ->> 'role') in ('senior_manager', 'staff')
             then 'hod'::public.user_role
           else (auth.jwt() -> 'app_metadata' ->> 'role')::public.user_role
         end;
$function$;

-- ── The four department-scoped decision RPCs ────────────────────────────────
-- `hod_dept` keeps its own coalesce: a DEPARTMENT is not a permission, and a
-- session carrying one only in user_metadata is a session whose owner would
-- otherwise be told their account belongs to no department.
create or replace function public.approve_visit(visit_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  hod_dept uuid;
  visit_dept uuid;
  visit_status public.visit_status;
  jwt_role text := public.effective_role();
begin
  hod_dept := coalesce((auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid, (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid);
  if jwt_role not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can approve visits.';
  end if;
  if jwt_role = 'hod' and hod_dept is null then
    raise exception 'Your account is not assigned to any department.';
  end if;
  select department_id, status into visit_dept, visit_status
    from public.visits where id = visit_id;
  if visit_dept is null then
    raise exception 'Visit not found.';
  end if;
  if jwt_role = 'hod' and hod_dept <> visit_dept then
    raise exception 'You can only approve visits in your own department.';
  end if;
  if visit_status <> 'pending_approval' then
    raise exception 'This request has already been decided.';
  end if;

  update public.visits
    set status = 'walkin_approved',
        rejection_reason = null
    where id = visit_id;
end;
$function$;

create or replace function public.reject_visit(visit_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  hod_dept uuid;
  visit_dept uuid;
  jwt_role text := public.effective_role();
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
  if visit_dept is null then raise exception 'Visit not found.'; end if;
  if jwt_role = 'hod' and hod_dept <> visit_dept then
    raise exception 'You can only reject visits in your own department.';
  end if;
  update public.visits set status = 'rejected', rejection_reason = trim(reason) where id = visit_id;
end;
$function$;

create or replace function public.cancel_visit(visit_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  hod_dept uuid;
  visit_dept uuid;
  visit_status public.visit_status;
  jwt_role text := public.effective_role();
begin
  hod_dept := coalesce((auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid, (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid);
  if jwt_role not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can cancel a pre-approval.';
  end if;
  if jwt_role = 'hod' and hod_dept is null then
    raise exception 'Your account is not assigned to any department.';
  end if;
  select department_id, status into visit_dept, visit_status
  from public.visits where id = visit_id;
  if visit_dept is null then
    raise exception 'Visit not found.';
  end if;
  if jwt_role = 'hod' and hod_dept <> visit_dept then
    raise exception 'You can only cancel visits in your own department.';
  end if;
  if visit_status not in ('approved','walkin_approved') then
    raise exception 'Only a pre-approved visit can be cancelled (current status: %).', visit_status;
  end if;
  update public.visits set status = 'cancelled' where id = visit_id;
end;
$function$;

create or replace function public.cancel_all_pre_approved(p_department_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count int;
  hod_dept uuid;
  jwt_role text := public.effective_role();
begin
  hod_dept := coalesce((auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid, (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid);
  if jwt_role not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can cancel pre-approvals.';
  end if;
  if p_department_id is null then
    raise exception 'A department is required.';
  end if;
  if jwt_role = 'hod' and (hod_dept is null or hod_dept <> p_department_id) then
    raise exception 'You can only cancel pre-approvals in your own department.';
  end if;
  update public.visits set status = 'cancelled'
  where department_id = p_department_id
    and status in ('approved','walkin_approved')
    and created_at >= date_trunc('day', now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.clear_pre_approved()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count int;
  v_jwt_role text;
  v_dept_id uuid;
begin
  v_jwt_role := public.effective_role();
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
$function$;

grant execute on function public.effective_role() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.approve_visit(uuid) to authenticated;
grant execute on function public.reject_visit(uuid, text) to authenticated;
grant execute on function public.cancel_visit(uuid) to authenticated;
grant execute on function public.cancel_all_pre_approved(uuid) to authenticated;
grant execute on function public.clear_pre_approved() to authenticated;
