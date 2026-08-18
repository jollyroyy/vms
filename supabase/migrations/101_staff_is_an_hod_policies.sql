-- 101 — the second half of "every account that is not a guard and not an admin
-- is an HOD" (client instruction, 2026-08-18). APPLY 100 FIRST: everything here
-- calls `public.effective_role()`, which 100 creates. The split is this
-- project's 300-line cap and nothing else.
--
-- Three groups, all of them objects that read the JWT claim directly and were
-- therefore missed by 099's `current_user_role()` mapping:
--
--   1) enforce_visit_update_rules — the trigger that decides which role may
--      make which status transition. Until now a senior manager approving a
--      walk-in got past `approve_visit` only to be refused HERE.
--   2) the five policies whose expression inlines `auth.jwt()`.
--   3) notify_hod_on_visit — not a permission at all, but the same wrong
--      question: it looked up ONE profile with `role = 'hod'` and notified it,
--      so a department headed by a senior manager, or staffed only by hosts,
--      got no notification when a visitor was standing at the gate.

-- ── 1) The status-transition trigger ────────────────────────────────────────
-- Live body verbatim (pg_get_functiondef, 2026-08-18) with `jwt_role` sourced
-- from effective_role(). Every branch below is unchanged; 082's
-- pending_approval <-> lapsed pair and 074's 15-minute check-out undo are the
-- two most recently added and must both survive this replace — diff it.
create or replace function public.enforce_visit_update_rules()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  jwt_role text := public.effective_role();
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
$function$;

-- ── 2) The five policies that inline the JWT claim ──────────────────────────
-- Same sets, same shapes, same names. The only change in each is that the role
-- comes from effective_role() instead of being read out of the token inline.
drop policy if exists "visitors: guard/hod/admin can insert" on public.visitors;
create policy "visitors: guard/hod/admin can insert"
  on public.visitors for insert to authenticated
  with check (public.effective_role() in ('guard','hod','admin','super_admin'));

drop policy if exists "visitors: guard/hod/admin can update" on public.visitors;
create policy "visitors: guard/hod/admin can update"
  on public.visitors for update to authenticated
  using (public.effective_role() in ('guard','hod','admin','super_admin'))
  with check (public.effective_role() in ('guard','hod','admin','super_admin'));

drop policy if exists "hod_select_recurring" on public.recurring_visits;
create policy "hod_select_recurring"
  on public.recurring_visits for select to authenticated
  using (
    public.effective_role() in ('hod','admin','super_admin')
    and (
      public.effective_role() in ('admin','super_admin')
      or department_id::text = (auth.jwt() -> 'app_metadata' ->> 'department_id')
    )
  );

drop policy if exists "hod_insert_recurring" on public.recurring_visits;
create policy "hod_insert_recurring"
  on public.recurring_visits for insert to authenticated
  with check (
    public.effective_role() in ('hod','admin','super_admin')
    and (
      public.effective_role() in ('admin','super_admin')
      or department_id::text = (auth.jwt() -> 'app_metadata' ->> 'department_id')
    )
  );

drop policy if exists "hod_update_recurring" on public.recurring_visits;
create policy "hod_update_recurring"
  on public.recurring_visits for update to authenticated
  using (
    public.effective_role() in ('hod','admin','super_admin')
    and (
      public.effective_role() in ('admin','super_admin')
      or department_id::text = (auth.jwt() -> 'app_metadata' ->> 'department_id')
    )
  );

-- ── 3) Who is told a visitor is waiting ─────────────────────────────────────
-- WAS: one row, `select p.id ... where role = 'hod' limit 1`. A department
-- whose head is a senior manager got nothing, and a department of hosts with no
-- head got nothing — the request sat on the Overview until somebody happened to
-- look. It is now a fan-out over the department's APPROVERS plus the named
-- host, deduped by `distinct`, which is the same set the console now shows the
-- decision buttons to.
--
-- The host is included even when their role is not an approver one, because the
-- visitor is there to see THEM; and they are matched on the department too, so
-- a stale host_id from another department cannot pull a stranger onto the list.
create or replace function public.notify_hod_on_visit()
returns trigger
language plpgsql
security definer
as $function$
declare
  dept_nm text;
  vis_nm  text;
begin
  select name into dept_nm from public.departments where id = new.department_id;
  select full_name into vis_nm from public.visitors where id = new.visitor_id;

  insert into public.notifications (recipient_id, type, title, body, related_id)
  select distinct p.id,
         -- The cast is load-bearing: under SELECT DISTINCT an untyped literal is
         -- resolved as `text` before the INSERT target can coerce it, and the
         -- trigger raised 42804 on every walk-in request without it.
         'visit_pending_approval'::public.notification_type,
         'Visitor approval needed — ' || coalesce(dept_nm, 'your department'),
         coalesce(vis_nm, 'A visitor') || ' is at the gate waiting for your approval. Ref: ' || new.ref_number,
         new.id
  from public.profiles p
  where p.department_id = new.department_id
    and (p.role in ('hod', 'senior_manager', 'staff') or p.id = new.host_id);

  return new;
end;
$function$;
