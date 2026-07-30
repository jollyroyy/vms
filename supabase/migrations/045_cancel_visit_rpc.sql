-- 045 — Make "Cancel Pre-Approval" actually work for HODs.
--
-- Root cause: public.visits has NO update policy for the hod role. Live
-- pg_policy shows only "visits: admin updates any" and "visits: guard
-- updates checkin/checkout". (Migration 022 would have added
-- "visits: hod updates own department", but 022 was never applied to this
-- project — the same file/DB drift documented in 043.)
--
-- So useVisitDecisions' direct `.update({status:'cancelled'})` matched zero
-- rows: RLS silently filtered the row out, PostgREST returned no error, and
-- the UI flashed "Pre-approval cancelled." while nothing had changed.
--
-- HOD approve/reject never hit this because they go through the
-- approve_visit / reject_visit SECURITY DEFINER RPCs. Cancel was the only
-- HOD write doing a raw table update. Fix it the same way the rest of the
-- codebase does: a SECURITY DEFINER RPC that validates department ownership
-- from the JWT and then performs the update with owner privileges.

create or replace function public.cancel_visit(visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
  visit_status public.visit_status;
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');
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
$$;

revoke execute on function public.cancel_visit(uuid) from anon, public;
grant execute on function public.cancel_visit(uuid) to authenticated;

-- Department-scoped "cancel every pre-approval for today". Replaces the
-- frontend's direct bulk update, which failed for exactly the same reason.
-- Note this is deliberately narrower than the old clear_pre_approved(),
-- which cleared EVERY department's approved visits regardless of caller.
create or replace function public.cancel_all_pre_approved(p_department_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  hod_dept uuid;
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');
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
$$;

revoke execute on function public.cancel_all_pre_approved(uuid) from anon, public;
grant execute on function public.cancel_all_pre_approved(uuid) to authenticated;
