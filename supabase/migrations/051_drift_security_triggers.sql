-- 051 — DRIFT RECONCILIATION 6/10: missing security triggers + state machine.
--
-- This is the highest-severity part of the audit.
--
-- ── GAP 1 (SECURITY): guards and HODs can blacklist visitors ────────────────
-- 022_harden_rls_audit.sql pairs a broad visitors UPDATE policy with a trigger,
-- public.prevent_guard_blacklist(), that stops anyone below admin from touching
-- is_blacklisted / blacklist_reason. The live database has the broad policy
-- ("visitors: guard/hod/admin can update") but NEITHER the function NOR the
-- check_visitor_blacklist_update trigger — both are absent from pg_proc and
-- pg_trigger. So today any guard or HOD can blacklist or un-blacklist any
-- visitor by writing the column directly. Restored below.
--
-- ── GAP 2: past check-in/check-out timestamps are not blocked ───────────────
-- 035_prevent_past_checkin_checkout.sql is entirely unapplied.
-- FIX vs 035: its body reads OLD.checked_in_at / OLD.checked_out_at, but the
-- trigger is declared BEFORE INSERT OR UPDATE. On INSERT, PL/pgSQL leaves OLD
-- unassigned and any reference to it raises `record "old" is not assigned yet`,
-- which would have made every visit INSERT that carries a check-in timestamp
-- fail outright. Guarded with TG_OP here.
--
-- ── GAP 3: no_show has no legal transition ──────────────────────────────────
-- 046 adds the enum label, and src/lib/visitLifecycle.ts:25,31 already models
-- `approved -> no_show` and `no_show -> approved` (HOD reactivate). The live
-- enforce_visit_update_rules() would reject both with 'Invalid status
-- transition'. Both branches added, keeping every existing branch intact
-- (including the `-> cancelled` branch added by 044).

-- ── GAP 1 ───────────────────────────────────────────────────────────────────
create or replace function public.prevent_guard_blacklist()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    if new.is_blacklisted   is distinct from old.is_blacklisted
    or new.blacklist_reason is distinct from old.blacklist_reason then
      raise exception 'Only admin can modify blacklist status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_visitor_blacklist_update on public.visitors;
create trigger check_visitor_blacklist_update
  before update on public.visitors
  for each row
  execute function public.prevent_guard_blacklist();

-- ── GAP 2 ───────────────────────────────────────────────────────────────────
create or replace function public.prevent_past_timestamps()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;

  if new.checked_in_at is not null
     and (tg_op = 'INSERT' or new.checked_in_at is distinct from old.checked_in_at)
     and new.checked_in_at < (now() - interval '5 minutes')
  then
    raise exception 'Check-in time cannot be in the past';
  end if;

  if new.checked_out_at is not null
     and (tg_op = 'INSERT' or new.checked_out_at is distinct from old.checked_out_at)
     and new.checked_out_at < (now() - interval '5 minutes')
  then
    raise exception 'Check-out time cannot be in the past';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_past_timestamps on public.visits;
create trigger trg_prevent_past_timestamps
  before insert or update on public.visits
  for each row
  execute function public.prevent_past_timestamps();

-- ── GAP 3 ───────────────────────────────────────────────────────────────────
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
    -- New: a pre-approved visitor who never arrived. Written either by
    -- public.mark_no_shows() (see 052) or manually by the approving authority.
    elsif old.status = 'approved' and new.status = 'no_show' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can mark a visitor as no-show.';
      end if;
    -- New: HOD reactivates a no-show (src/lib/visitLifecycle.ts:31).
    elsif old.status = 'no_show' and new.status = 'approved' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can reactivate a no-show.';
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
