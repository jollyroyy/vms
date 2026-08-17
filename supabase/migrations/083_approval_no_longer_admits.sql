-- 083 — the approver clears the walk-in; the GUARD admits them. Reverts 080's shortcut.
--
-- APPLIED + VERIFIED LIVE 2026-08-17. See the verification block at the bottom
-- of this file.
--
-- Client instruction, 2026-08-17: "once the guard sends out for the approval it
-- will still not show as check-in. Once the walk-in is approved by the HOD then
-- only the check-in box should appear for that person. When the guard clicks on
-- check-in that time he can enter the [card] number and then do the checking for
-- the visitor … until and unless approval is given the guard cannot check in.
-- Till that time it will show as waiting for approval."
--
-- WHAT THIS UNDOES, AND WHY THE ORIGINAL REASONING NO LONGER HOLDS.
-- 080 collapsed the host's decision and the visitor's entry into one click, on
-- the grounds that `WalkInRequest` already collects the ID scan and the photo
-- that the old gate step existed to capture, so the second click was
-- re-photographing somebody standing at the desk. That argument was sound about
-- the PHOTO and the ID and wrong about the third thing the gate step collected:
-- 080's own header records the gap — the VISITOR CARD NUMBER is not on that
-- form, so every walk-in admitted by the shortcut reached check-out with
-- `visitor_card_number` null, and `CardReturnConfirm` had no card to demand
-- back. Migration 076 exists to make a visitor card leave the building with the
-- visitor; on this route it was inert.
--
-- The two ways out of that were to move the card onto the registration form, or
-- to put the admission back at the gate where the card is physically handed
-- over. The client chose the gate, which is also the honest answer: the moment
-- a card is issued and the moment the app records an arrival should be the same
-- moment, and only the guard is standing there for it.
--
-- The `walkin_approved` holding state therefore carries new rows again. It was
-- never retired (080 §2 kept every transition into and out of it, and live rows
-- have been resting there throughout), so nothing has to be recreated — the app
-- surface that admits those rows, `GuardWalkInApproved`, was likewise left
-- intact and already demands a photo, an ID scan and a card number before it
-- will write `checked_in`.
--
-- ROWS ADMITTED BY THE SHORTCUT ARE LEFT ALONE. Between 2026-08-16 and today
-- some walk-ins went `pending_approval -> checked_in` on an approver's click.
-- Those visitors really did enter the building, so their `checked_in_at` is a
-- true statement about the world and is not rewritten here. They keep a null
-- `visitor_card_number` and will check out through the "no card was issued"
-- branch of the return gate. Backdating history to make a report tidier is the
-- one thing a visitor log must never do.

-- ── 1. The state machine forgets the shortcut ───────────────────────────────
-- REBASED ON 082, NOT ON 080, AND THAT DISTINCTION IS THE WHOLE RISK IN THIS
-- FILE. `enforce_visit_update_rules` has been re-created three times; the LIVE
-- definition is migration 082's, which carried 080's shortcut forward verbatim
-- and added two branches of its own — `pending_approval -> lapsed` and
-- `lapsed -> pending_approval`, the day-end sweep for a request nobody
-- answered. Writing this function from 080's text would have compiled, applied
-- cleanly, and silently deleted both of them, breaking the 10 PM sweep with no
-- error anywhere. That is not hypothetical: memory.md SB-15 records migration
-- 015 dropping the `walkin_approved` branches exactly this way, and 022 having
-- to put them back. Before replacing a trigger function here, always find its
-- most recent CREATE, not the migration that last discussed it.
--
-- So: byte-for-byte 082's body with ONE branch deleted, `pending_approval ->
-- checked_in`. It now falls through to the final `else` and raises "Invalid
-- status transition", which is the correct answer — an approver reaching for it
-- is trying to admit somebody from a desk that cannot see the gate.
--
-- The `checked_in_at` re-stamp above the status block is untouched and still
-- load-bearing: the trigger, not the caller, is the authority on arrival times.
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
    -- 080's `pending_approval -> checked_in` branch was HERE and is deliberately
    -- gone. Do not restore it without moving the visitor card number onto the
    -- registration form first; that is the whole reason it was removed.
    --
    -- 082's two branches, carried forward unchanged. The sweep itself runs as
    -- service_role and short-circuits at the top; these are the human entry
    -- point, `mark_no_shows()` under an HOD's own JWT.
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

-- ── 2. approve_visit clears the visitor; it does not admit them ─────────────
-- Back to `walkin_approved`, and `checked_in_at` is NOT written — the visitor
-- is not inside, and a timestamp saying they are is worse than no timestamp.
-- The guard's check-in sets it, and the trigger above re-stamps it to `now()`
-- at that moment, so arrival time keeps a single author.
--
-- 080 wrapped the update in an `exception when unique_violation` handler to
-- translate migration 060's one-open-visit index into readable prose. That
-- handler is dropped rather than kept: 060's index is PARTIAL on
-- `status = 'checked_in'`, so a write landing on `walkin_approved` cannot
-- violate it and the branch could never fire. The clash it guarded against
-- still exists — it just belongs at the gate again, where the guard's check-in
-- raises it against a visitor who never checked out of a previous visit.
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

  update public.visits
    set status = 'walkin_approved',
        rejection_reason = null
    where id = visit_id;
end;
$$;

-- ── 3. The audit trail stops claiming an arrival ────────────────────────────
-- One update, ONE event again. The `pending_approval -> checked_in` branch
-- wrote a `visit_approved` row carrying `admitted: true` AND a `visit_checked_in`
-- row off a single approver click; neither can be produced by that transition
-- any more, and leaving the branch in place would keep a code path that says a
-- visitor entered the building on the strength of a decision.
--
-- `approvalTimestamp()` (lib/visitApproval.ts) and the admin register's
-- "Approved By" column read the `visit_approved` row, which the FIRST branch
-- still writes for `walkin_approved` — so both keep their answer. The activity
-- log's `visit_checked_in` row now comes from the guard's own write, through the
-- `approved`/`walkin_approved -> checked_in` branch below, which is where it
-- described a real arrival all along.
create or replace function public.log_visit_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if new.status in ('approved', 'walkin_approved') and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_approved', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'status', new.status));
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

-- ── NOT TOUCHED, on purpose ─────────────────────────────────────────────────
-- `pre_approve_visitor_v2` (080 §4) and `get_profile_names` (080 §5) are
-- unrelated to the shortcut and keep 080's definitions. In particular
-- `pre_approve_visitor_v2` still writes its own `visit_approved` audit row for
-- a row born `approved`, which is what lets the register name who issued a pass.
-- Re-running this migration must not drop them; note that `get_profile_names`
-- was a DROP/CREATE in 080 and its ACL is already set — do not DROP it again.

-- ── VERIFICATION (run under a real HOD JWT, not postgres) ───────────────────
-- postgres bypasses `is_service_role()` and every role check above, so psql as
-- superuser proves nothing here — the 064 lesson. Against a probe walk-in:
--   1. approve_visit(id) as an HOD  -> status = 'walkin_approved',
--      checked_in_at IS NULL, exactly ONE new audit row, action = 'visit_approved',
--      details->>'status' = 'walkin_approved' and NO 'admitted' key.
--   2. update visits set status='checked_in' as that same HOD
--      -> raises 'Only the guard can log check-in.'
--   3. update visits set status='checked_in' from 'pending_approval' as an HOD
--      -> raises 'Invalid status transition: pending_approval -> checked_in'.
--   4. update visits set status='checked_in' as the GUARD -> succeeds,
--      checked_in_at stamped by the trigger, one 'visit_checked_in' audit row.
-- Delete the probe rows afterwards.
