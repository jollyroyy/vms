-- 043 — Department-scoped data separation audit (S9/SEC-5 follow-up).
--
-- Triggered by: an HOD must never see another HOD's visitors/guests, in
-- Reports or anywhere else. Auditing pg_policies on the live project turned
-- up two distinct problems:
--
-- 1) MIGRATION-FILE DRIFT: migration 022 rewrote "visits: read scoped by
--    role" and "visitors: read scoped by role" down to `using (true)` —
--    fully open to every authenticated user regardless of department. That
--    part of 022 was never actually applied to this project (list_migrations
--    shows only server_authority/app_metadata_privilege_fix/etc. tracked;
--    022 itself is absent), so the LIVE database still has the correct
--    department-scoped policies from 008/010/016. But the migration FILES
--    on disk describe the broken `using (true)` state, so replaying them
--    from scratch onto a fresh project (new env, staging, disaster
--    recovery) would silently reintroduce the cross-department leak. This
--    section re-asserts the correct, narrow policies so the file history
--    matches reality and stays safe to replay.
--
-- 2) LIVE BUG: public.gate_passes and public.gate_pass_items have only ever
--    had the original "all authenticated can read" (`using (true)`) policy
--    from 002 — every authenticated user, any department, can read every
--    gate pass and every gate pass item. (There is also a `gatepass_select`
--    policy visible in pg_policies, but it belongs to a separate, unused
--    `gatepass.gate_passes` / `gatepass.gate_pass_items` schema — a distinct
--    table with the same base name, not a second policy on the table this
--    app actually queries. It does not scope public.gate_passes at all.)
--    Replace the open policy with real department scoping, mirroring the
--    visits fix above: guard/admin/super_admin see everything, everyone
--    else only their own department's gate passes (items scoped via their
--    parent gate pass's department, since gate_pass_items has no
--    department_id column of its own).

-- ── 1) visits SELECT: JWT + column only, no subquery (proven safe pattern) ──
drop policy if exists "visits: all authenticated can read" on public.visits;
drop policy if exists "visits: read scoped by role" on public.visits;
create policy "visits: read scoped by role"
  on public.visits for select to authenticated
  using (
    public.current_user_role() in ('guard', 'admin', 'super_admin')
    or department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
  );

-- ── 2) visitors SELECT: visible only if the visitor has a visit in the
--    caller's own department (or caller is guard/admin). Safe: visits' own
--    SELECT policy above never references visitors, so this cannot recurse. ──
drop policy if exists "visitors: all authenticated can read" on public.visitors;
drop policy if exists "visitors: read scoped by role" on public.visitors;
create policy "visitors: read scoped by role"
  on public.visitors for select to authenticated
  using (
    public.current_user_role() in ('guard', 'admin', 'super_admin')
    or exists (
      select 1 from public.visits
      where visits.visitor_id = visitors.id
        and visits.department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
    )
  );

-- ── 3) gate_passes / gate_pass_items: replace the wide-open policy with
--    real department scoping. ──
drop policy if exists "gate_passes: all authenticated can read" on public.gate_passes;
drop policy if exists "gate_passes: read scoped by role" on public.gate_passes;
create policy "gate_passes: read scoped by role"
  on public.gate_passes for select to authenticated
  using (
    public.current_user_role() in ('guard', 'admin', 'super_admin')
    or department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
  );

drop policy if exists "items: all authenticated can read" on public.gate_pass_items;
drop policy if exists "gate_pass_items: read scoped by role" on public.gate_pass_items;
create policy "gate_pass_items: read scoped by role"
  on public.gate_pass_items for select to authenticated
  using (
    public.current_user_role() in ('guard', 'admin', 'super_admin')
    or exists (
      select 1 from public.gate_passes gp
      where gp.id = gate_pass_items.gate_pass_id
        and gp.department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
    )
  );

-- ── 4) audit_logs: let a viewer read log rows for visits they can already
--    see (own department), not just admins. Needed so Reports can show
--    "Approved by <name>" / "Rejected by <name>" without widening admin-only
--    access to the rest of the audit trail. Safe: visits' policy (above)
--    has no reference back to audit_logs, so no recursion. ──
drop policy if exists "audit_logs: read via visit access" on public.audit_logs;
create policy "audit_logs: read via visit access"
  on public.audit_logs for select to authenticated
  using (
    entity_type = 'visit'
    and exists (select 1 from public.visits where visits.id = audit_logs.entity_id)
  );

-- ── 5) log_visit_approval: the state machine also allows guard/hod/admin to
--    reject an already-approved/walk-in-approved visitor at the gate
--    (enforce_visit_update_rules, old status in ('approved','walkin_approved')
--    -> 'rejected'), but the trigger only ever logged rejections that
--    originated from 'pending_approval'. Add the missing branch so every
--    rejection has an actor in the audit trail. ──
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
