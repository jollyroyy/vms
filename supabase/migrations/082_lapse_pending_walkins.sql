-- 082 — an unanswered walk-in request lapses when its day ends.
--
-- See 081 for why `lapsed` is a status of its own rather than a reuse of
-- `expired`. This migration is the rule and the sweep.
--
-- THE PREDICATE is 077's, unchanged in shape: the day containing the visit's
-- own moment has ENDED (22:00 IST, migration 075). A pending request never has
-- a `scheduled_for` — `WalkInRequest` and the kiosk are its only writers and
-- both insert null — so its moment is its `created_at`, exactly as the
-- `expired` branch already treats a slotless approval. Comparing against the
-- visit's own day rather than today's close is what makes the sweep safe to run
-- at any hour and idempotent; 077 exists because that distinction was got wrong
-- once and filed a 18:30 visitor at 17:10.
--
-- NOTHING IS NUDGED OR SUMMARISED HERE. 070's `nudge_overdue_visits` and 075's
-- `send_no_show_summary` both key on `scheduled_for`, which these rows do not
-- have — there is no slot to be late for. A host who never answered a request
-- gets no new message; the request simply stops claiming a decision is coming.

-- ── 1. The transitions ──────────────────────────────────────────────────────
-- `pending_approval -> lapsed` and the way back. The reactivation matters as
-- much as the sweep (the rule 066 wrote down): a status written by a machine
-- must be reversible by a human, or a wrongly-closed request has no route back
-- except a brand new one raised from scratch at the gate.
--
-- The way back is to `pending_approval`, NOT to an approved state. Nobody
-- decided this request; reopening it must put the decision back in front of the
-- host, not invent the answer they never gave.
--
-- Otherwise byte-identical to 080's body.
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
    -- THE SHORTCUT (080). The approver admits the visitor in the same act as
    -- the decision; nobody is left in a holding state waiting for a second click.
    elsif old.status = 'pending_approval' and new.status = 'checked_in' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can approve walk-in visitors.';
      end if;
    -- NEW (082). The sweep runs as service_role and short-circuits above; this
    -- branch is the human entry point, `mark_no_shows()` under an HOD's own JWT.
    elsif old.status = 'pending_approval' and new.status = 'lapsed' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can close an unanswered request.';
      end if;
    elsif old.status = 'lapsed' and new.status = 'pending_approval' then
      if jwt_role not in ('hod','admin','super_admin') then
        raise exception 'Only HOD or Admin can reopen a lapsed request.';
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

-- ── 2. The sweep gains a third branch ───────────────────────────────────────
-- Both existing branches are 077's, byte-identical. The department scoping
-- applies to the new branch too: `pending_approval` rows always carry a
-- `department_id` (it is what routes them to a host), so `mark_no_shows()` run
-- by an HOD closes their own department's unanswered requests and nobody
-- else's.
create or replace function public.close_stale_approvals(p_all boolean, p_department uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n_no_show integer;
  n_expired integer;
  n_lapsed integer;
begin
  -- An appointment was made and missed: its own day has ended.
  update public.visits
  set status = 'no_show'
  where status in ('approved','walkin_approved')
    and checked_in_at is null
    and scheduled_for is not null
    and now() >= public.vms_day_end_ist(scheduled_for)
    and (p_all or department_id = p_department);
  get diagnostics n_no_show = row_count;

  -- No appointment to miss; the approval simply lapsed unused.
  update public.visits
  set status = 'expired'
  where status in ('approved','walkin_approved')
    and checked_in_at is null
    and scheduled_for is null
    and now() >= public.vms_day_end_ist(created_at)
    and (p_all or department_id = p_department);
  get diagnostics n_expired = row_count;

  -- Nobody ever decided. `created_at` is the moment the visitor stood at the
  -- gate and the request went to their host, so its day is the day the answer
  -- was needed — an answer that arrives the following morning is not an answer.
  --
  -- `checked_in_at is null` is redundant on this status (080 stamps it in the
  -- same update that leaves `pending_approval`) and is kept deliberately: every
  -- branch of this function states that attendance beats expiry, and a branch
  -- that relies on another migration's invariant to be safe is one edit away
  -- from closing a visit that happened.
  update public.visits
  set status = 'lapsed'
  where status = 'pending_approval'
    and checked_in_at is null
    and now() >= public.vms_day_end_ist(coalesce(scheduled_for, created_at))
    and (p_all or department_id = p_department);
  get diagnostics n_lapsed = row_count;

  return n_no_show + n_expired + n_lapsed;
end;
$$;

-- The 073 lesson: CREATE OR REPLACE keeps the ACL, but say it anyway — this
-- function has been dropped and recreated before and PUBLIC is the default.
revoke all on function public.close_stale_approvals(boolean, uuid) from public, authenticated, anon;
