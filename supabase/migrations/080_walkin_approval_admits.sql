-- 080 — an approved walk-in IS a check-in, and every approval records its approver.
--
-- Client instruction, 2026-08-16: "as soon as the required person approves the
-- walk-in, the status should be moved into the checked-in status … it should
-- reflect somehow whether it was walk-in approved and by whom."
--
-- WHY THIS IS NOW SAFE, AND WAS NOT BEFORE.
-- `walkin_approved` existed (migration 014) as a holding state between the
-- host's yes and the gate's photo: at registration nobody knew whether the
-- visitor would be let in, so their face was captured at the moment of entry
-- instead. Since 2026-08-16 `WalkInRequest` REFUSES to raise a request without
-- an ID scan and a photo, and the visitor card number is taken on the same
-- form — so by the time an approver sees the request, everything the old gate
-- step collected is already on the row. The second step had become a button
-- that re-photographed somebody who was standing at the desk the whole time.
--
-- `walkin_approved` is NOT retired. Live rows sit in it, /visitors/approved
-- still lists and admits them, and the state machine below still allows
-- `walkin_approved -> checked_in`. What changes is that nothing NEW enters it.
--
-- THE APPROVER IS RECORDED FOR BOTH ROUTES. `attachVisitActors` resolves an
-- approval's actor from the `visit_approved` audit row, and a pre-approval
-- never had one — it is INSERTed already `approved`, so the trigger (which
-- fires on a status CHANGE) never saw it. The admin register has to name who
-- cleared a visitor whichever desk they came through, so
-- `pre_approve_visitor_v2` now writes that row itself.

-- ── 1. The state machine learns the shortcut ────────────────────────────────
-- `pending_approval -> checked_in` is the approver's own write, so it is gated
-- on the APPROVER's roles, not the guard's. Every other branch is carried over
-- from 074 unchanged.
create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  jwt_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if public.is_service_role() then return new; end if;
  new.ref_number := old.ref_number;
  new.created_at := old.created_at;
  if new.checked_in_at is distinct from old.checked_in_at and new.checked_in_at is not null then
    if not (old.status = 'checked_out' and new.status = 'checked_in') then
      new.checked_in_at := now();
    end if;
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
    -- THE SHORTCUT. The approver admits the visitor in the same act as the
    -- decision; nobody is left in a holding state waiting for a second click.
    elsif old.status = 'pending_approval' and new.status = 'checked_in' then
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
    elsif old.status in ('approved','walkin_approved') and new.status = 'cancelled' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can cancel a pre-approval.';
      end if;
    elsif old.status in ('approved','walkin_approved') and new.status in ('no_show','expired') then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can mark a visitor as no-show.';
      end if;
    elsif old.status in ('no_show','expired') and new.status in ('approved','walkin_approved') then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can reactivate a no-show.';
      end if;
    elsif old.status = 'checked_in' and new.status = 'checked_out' then
      if jwt_role not in ('guard','admin','super_admin') then
        raise exception 'Only the guard can log check-out.';
      end if;
    elsif old.status = 'checked_out' and new.status = 'checked_in' then
      if jwt_role not in ('guard','admin','super_admin') then
        raise exception 'Only the guard can undo a check-out.';
      end if;
      if old.checked_out_at is null
         or old.checked_out_at < now() - interval '15 minutes' then
        raise exception
          'This check-out is no longer reversible — it was more than 15 minutes ago. Check the visitor in as a new visit.';
      end if;
      new.checked_out_at := null;
      new.exit_verified := null;
    else
      raise exception 'Invalid status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

-- ── 2. approve_visit admits the visitor ─────────────────────────────────────
-- `checked_in_at` is set explicitly and then re-stamped by the trigger above,
-- which is deliberate: the trigger is the authority on arrival times and this
-- function must not be the one place that can write a different one.
--
-- Only a `pending_approval` row is admitted. The guard exception below is the
-- one-open-visit-per-visitor index (migration 060) firing at approval time
-- instead of at the gate — the same rule, one step earlier — and it is caught
-- so an approver reads why rather than a constraint name.
create or replace function public.approve_visit(visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  hod_dept uuid;
  visit_dept uuid;
  visit_status public.visit_status;
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');
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

  begin
    update public.visits
      set status = 'checked_in',
          checked_in_at = now(),
          rejection_reason = null
      where id = visit_id;
  exception when unique_violation then
    raise exception 'That visitor is already checked in and has not been checked out.';
  end;
end;
$$;

-- ── 3. The audit trail keeps both facts ─────────────────────────────────────
-- The shortcut is ONE update carrying TWO events: a decision (who cleared this
-- visitor) and an arrival (they are inside). Both rows are written, because
-- `approvalTimestamp()` and the "Approved By" column read the first and the
-- activity log reads the second — collapsing them would leave one of the two
-- surfaces unable to answer its own question.
create or replace function public.log_visit_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if new.status in ('approved', 'walkin_approved') and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_approved', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'status', new.status));
  elsif new.status = 'checked_in' and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_approved', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'status', new.status, 'admitted', true));
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_checked_in', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number));
  elsif new.status = 'rejected' and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_rejected', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'reason', new.rejection_reason));
  elsif new.status = 'checked_in' and old.status in ('approved', 'walkin_approved') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_checked_in', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number));
  elsif new.status = 'checked_out' and old.status = 'checked_in' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_checked_out', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number));
  end if;
  return new;
end;
$$;

-- ── 4. A pre-approval names its approver too ────────────────────────────────
-- Same signature as 073, so CREATE OR REPLACE keeps the ACL (073's own note:
-- only a DROP resets it to PUBLIC). The only change is the audit insert, which
-- is legal here and nowhere else: migration 063 revoked INSERT on audit_logs
-- from `authenticated` precisely so that SECURITY DEFINER functions are the
-- only writers.
create or replace function public.pre_approve_visitor_v2(
  p_phone text, p_full_name text, p_vendor_name text,
  p_department_id uuid, p_host_id uuid, p_purpose text,
  p_scheduled_for timestamptz default null,
  p_expected_departure timestamptz default null
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_visitor_id uuid;
  v_visit_id uuid;
  v_ref text;
begin
  insert into public.visitors (phone, full_name, vendor_name)
  values (p_phone, p_full_name, nullif(p_vendor_name, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    vendor_name = coalesce(nullif(p_vendor_name, ''), visitors.vendor_name)
  returning id into v_visitor_id;

  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material, scheduled_for, expected_departure, qr_expires_at
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved',
    false, p_scheduled_for, p_expected_departure,
    public.vms_day_end_ist(coalesce(p_expected_departure, p_scheduled_for, now()))
  )
  returning id, ref_number into v_visit_id, v_ref;

  -- The row is born approved, so no status ever CHANGES and log_visit_approval
  -- never fires. Without this line the register can name who cleared a walk-in
  -- and not who issued a pass, which reads as though nobody issued it.
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'visit_approved', 'visit', v_visit_id,
    jsonb_build_object('ref_number', v_ref, 'status', 'approved', 'pre_approval', true));

  return json_build_object('ref_number', v_ref);
end;
$$;

-- ── 5. The approver's DEPARTMENT, for the admin register ────────────────────
-- The admin's "Approved By" column names the person AND the department they
-- speak for, because one name means little across an org with many desks. A
-- new OUT column cannot be added with CREATE OR REPLACE, so this is a DROP and
-- CREATE — which resets the ACL to PUBLIC (the 073 lesson), hence the explicit
-- grants and revokes below, restated exactly as migrations 005/010 left them.
drop function if exists public.get_profile_names(uuid[]);

create function public.get_profile_names(profile_ids uuid[])
returns table (id uuid, full_name text, role public.user_role, department_name text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select p.id, p.full_name, p.role, d.name
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = any(profile_ids);
end;
$$;

revoke execute on function public.get_profile_names(uuid[]) from public, anon;
grant execute on function public.get_profile_names(uuid[]) to authenticated, service_role, postgres;
