-- 044 — Allow HOD "Cancel Pre-Approval" to actually take effect.
--
-- Bug: 034 added the 'cancelled' value to the visit_status enum so HODs could
-- cancel a pre-approval, but enforce_visit_update_rules() (from 022) was never
-- updated with a matching transition branch. Every attempt to set
-- status='cancelled' fell through to the trigger's `else` clause and raised
-- "Invalid status transition: approved -> cancelled", so useVisitDecisions'
-- cancelVisit()/clearAllApproved() silently failed with an error banner and
-- the visit never left the Approved list.

create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql set search_path = '' as $$
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
    elsif old.status in ('approved','walkin_approved') and new.status = 'cancelled' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can cancel a pre-approval.';
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

-- Give cancellations an audit trail entry, same pattern as approve/reject/checkin/checkout.
create or replace function public.log_visit_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if new.status in ('approved', 'walkin_approved') and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_approved', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'status', new.status));
  elsif new.status = 'rejected' and old.status in ('pending_approval', 'approved', 'walkin_approved') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_rejected', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'reason', new.rejection_reason));
  elsif new.status = 'cancelled' and old.status in ('approved', 'walkin_approved') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_cancelled', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number));
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
