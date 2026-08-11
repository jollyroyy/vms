-- 066 — the no-show sweep now closes EVERY un-arrived approval, not a subset.
--
-- WHAT WAS ACTUALLY BROKEN (live evidence, 2026-08-11)
--
-- 061 installed pg_cron and the job has been running nightly and succeeding —
-- `cron.job_run_details` shows 7 successful runs and there are 7 `no_show` rows,
-- so the sweep is not dead. It just could not reach most of what it should:
--
--   1. `and scheduled_for is not null` skipped every row without a scheduled
--      time. EVERY walk-in is such a row — WalkInRequest never sets
--      scheduled_for — as are the pre-approvals created before
--      validatePreApproval made it mandatory.
--   2. `status = 'approved'` alone skipped `walkin_approved` entirely.
--
-- Live at the time of writing: 7 approvals that can never be swept, the oldest
-- created 2026-08-01, still offering themselves for check-in ten days later.
-- Three are `walkin_approved`, and those are the visible ones: Console.loadVisits
-- deliberately ORs in `status.in.(pending_approval,walkin_approved,checked_in)`
-- with NO date bound so that overnight work is not dropped at midnight, so the
-- guard's "Approved, waiting to enter" list shows every such row for all time.
--
-- That unbounded window is CORRECT and must stay. It is only safe, though, if
-- something eventually closes those statuses — an open-ended list and a sweep
-- that cannot close it are the two halves of one design, and 061 shipped one.
--
-- no_show VS expired — see 065 for why these are two statuses. The rule is drawn
-- on whether an appointment existed, not on which route created the visit:
--
--   scheduled_for IS NOT NULL -> no_show   (an appointment was missed)
--   scheduled_for IS NULL     -> expired   (an approval lapsed unused)
--
-- END OF DAY, NOT A GRACE PERIOD. 061 removed the "grace_period_minutes past the
-- slot" rule because it killed a visit while the visitor was still walking to
-- the gate. That fix went into the scheduled path only: `mark_no_shows()` — the
-- HOD/admin-callable entry point — still used `scheduled_for < now()`, so an HOD
-- running it at 14:00 would kill a 10:00 visit whose visitor was mid-journey,
-- reintroducing the exact bug 061 removed. Both paths now share one predicate.

-- 1) The day boundary, in one place.
--
-- 061 put the timezone decision in the cron schedule (18:30 UTC = 00:00 IST) and
-- left the SQL saying `scheduled_for < now()`. That works only if the job runs at
-- exactly the right instant and never runs by hand — a manual invocation at any
-- other hour silently means something different. Naming the boundary makes the
-- predicate mean "the day containing this visit's moment has ENDED", which is
-- true whenever it is evaluated, so the function is safe to run at any time and
-- is idempotent. The cron schedule stays as it is; it now merely decides how
-- soon after the boundary the sweep happens, not what the rule is.
create or replace function public.vms_day_start_ist()
returns timestamptz language sql stable set search_path = '' as $$
  select date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
$$;

comment on function public.vms_day_start_ist() is
  'Midnight IST of the current day, as timestamptz. The one place the deployment''s day boundary is defined.';

grant execute on function public.vms_day_start_ist() to authenticated, service_role;

-- 2) Allow the transitions the sweep needs.
--
-- `walkin_approved -> no_show|expired` and `approved -> expired` were not in the
-- transition table at all, so they raised 'Invalid status transition'. The
-- scheduled sweeps short-circuit on is_service_role() and never noticed, but
-- mark_no_shows() called by a real HOD would have failed on every walk-in.
--
-- The reactivations matter as much as the sweeps: a status written by a machine
-- must be reversible by a human, or a wrongly-swept visitor has no way back in
-- except a brand new request. `no_show -> approved` already existed; `expired`
-- gets the same treatment for both of its origins.
create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    else
      raise exception 'Invalid status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

-- 3) The shared predicate, as one function both entry points call.
--
-- `p_all` is the service/admin case; otherwise the caller's department scopes it.
-- Written once so the human path and the nightly path can never drift apart —
-- which is precisely how 061's fix reached only one of them.
create or replace function public.close_stale_approvals(p_all boolean, p_department uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  boundary timestamptz := public.vms_day_start_ist();
  n_no_show integer;
  n_expired integer;
begin
  -- An appointment was made and missed.
  update public.visits
  set status = 'no_show'
  where status in ('approved','walkin_approved')
    and checked_in_at is null
    and scheduled_for is not null
    and scheduled_for < boundary
    and (p_all or department_id = p_department);
  get diagnostics n_no_show = row_count;

  -- No appointment to miss; the approval simply lapsed. `created_at` is the
  -- moment the approval came into existence, so its day is the day it was good
  -- for — the same day the guard would have been looking for the visitor.
  update public.visits
  set status = 'expired'
  where status in ('approved','walkin_approved')
    and checked_in_at is null
    and scheduled_for is null
    and created_at < boundary
    and (p_all or department_id = p_department);
  get diagnostics n_expired = row_count;

  return n_no_show + n_expired;
end;
$$;

revoke all on function public.close_stale_approvals(boolean, uuid) from public, authenticated, anon;

-- 4) The human entry point. Role- and department-scoped, as before.
create or replace function public.mark_no_shows()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  is_all boolean;
begin
  if not public.is_service_role() and jwt_role not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can sweep for no-shows.';
  end if;
  is_all := public.is_service_role() or jwt_role in ('admin','super_admin');
  return public.close_stale_approvals(
    is_all,
    (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
  );
end;
$$;

-- 5) The scheduled path. The set_config line is load-bearing: a cron session has
--    no JWT, so is_service_role() is false and enforce_visit_update_rules would
--    reject every row. Transaction-local, so it cannot leak. See 061.
create or replace function public.sweep_no_shows_daily()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  return public.close_stale_approvals(true, null);
end;
$$;

revoke all on function public.sweep_no_shows_daily() from public, authenticated, anon;
