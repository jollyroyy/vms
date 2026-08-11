-- 074 — a mis-clicked check-out can be taken back, briefly.
--
-- `checked_in -> checked_out` was a one-way door. A guard who clicks the wrong
-- row on a busy list leaves a visitor who is still in the building recorded as
-- gone, and there was no way back from the app: the transition table has no
-- reverse, so "who is inside" is wrong until someone edits the database by hand.
-- Migration 060 then compounds it — with the visit closed, that visitor can
-- start a new one, so the fix people would reach for (check them in again)
-- silently creates a SECOND visit row for one continuous presence.
--
-- WHY A TIME BOX AND NOT A ROLE. The obvious alternative was "admins can undo".
-- It fails twice over: admins have no route to visitor records at all in this
-- app (see the Admin scope note in CLAUDE.md), so the capability would exist
-- with nowhere to invoke it; and it makes correcting a five-second slip an
-- escalation. The mistake this repairs is discovered immediately — the visitor
-- is standing there — so a short window covers essentially every real instance
-- while making the power useless for rewriting yesterday.
--
-- UNDO_WINDOW_MINUTES is 15. Long enough for a guard to notice, deal with the
-- person in front of them, and come back to it; far too short to launder an
-- exit record after a shift.
--
-- WHY NOT AN AUDIT-ONLY APPROACH. Logging the reversal instead of restricting it
-- would keep the record honest but still let any guard reopen any closed visit
-- at any time, which is a real integrity hole given `exit_verified` is evidence.
-- The window is the restriction; the audit log already captures the transition.

create or replace function public.enforce_visit_update_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  jwt_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if public.is_service_role() then return new; end if;
  new.ref_number := old.ref_number;
  new.created_at := old.created_at;
  if new.checked_in_at is distinct from old.checked_in_at and new.checked_in_at is not null then
    -- EXCEPT when undoing a check-out: the visitor never left, so the original
    -- arrival time is the true one and stamping now() would rewrite history to
    -- hide the correction. Detected by the status move, not by a flag.
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
    -- THE UNDO.
    elsif old.status = 'checked_out' and new.status = 'checked_in' then
      if jwt_role not in ('guard','admin','super_admin') then
        raise exception 'Only the guard can undo a check-out.';
      end if;
      -- The window applies to EVERY check-out, including one written by
      -- sweep_overstays. Exempting auto-closed rows was tempting — nobody saw
      -- those visitors leave, so reopening one is correcting a guess rather than
      -- overriding an observation — but it would leave every exit_verified=false
      -- row reopenable forever, which is a standing hole in the one column that
      -- is meant to be evidence. That sweep is not even scheduled yet (067), so
      -- the case is hypothetical; revisit it when the sweep is switched on, with
      -- the exemption written deliberately rather than inherited.
      if old.checked_out_at is null
         or old.checked_out_at < now() - interval '15 minutes' then
        raise exception
          'This check-out is no longer reversible — it was more than 15 minutes ago. Check the visitor in as a new visit.';
      end if;
      -- The visitor never left, so the closure is erased rather than annotated.
      new.checked_out_at := null;
      new.exit_verified := null;
    else
      raise exception 'Invalid status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;
