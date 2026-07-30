-- 052 — DRIFT RECONCILIATION 7/10: no-show automation (from 036).
--
-- Depends on 046 (the `no_show` enum label), 047 (visits.grace_period_minutes)
-- and 051 (the `approved -> no_show` transition in enforce_visit_update_rules).
--
-- FIX vs 036:
--   * 036's trg_notify_no_show was AFTER UPDATE FOR EACH ROW with no WHEN
--     clause, so it fired on every single visit update just to test one
--     status pair. Narrowed with a WHEN clause, matching the pattern already
--     used by log_visit_changes.
--   * mark_no_shows() is security definer, but auth.jwt() still resolves to the
--     caller, so it goes through enforce_visit_update_rules like any other
--     write. That is intentional — 051 grants the transition to hod/admin, and
--     the service role short-circuits — but it means EXECUTE must not be open
--     to every authenticated user. 036 granted it to `authenticated` wholesale;
--     narrowed to a role check inside the function.

create or replace function public.mark_no_shows()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  if not public.is_service_role()
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('hod','admin','super_admin') then
    raise exception 'Only HOD or Admin can sweep for no-shows.';
  end if;

  update public.visits
  set status = 'no_show'
  where status = 'approved'
    and scheduled_for is not null
    and now() > (scheduled_for + (grace_period_minutes || ' minutes')::interval)
    -- An HOD sweeps only their own department; admin/service sweeps everything.
    and (
      public.is_service_role()
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin','super_admin')
      or department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.mark_no_shows() to authenticated;

create or replace function public.notify_no_show()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  hod_id uuid;
  vis_nm text;
begin
  select p.id into hod_id
  from public.profiles p
  where p.role = 'hod' and p.department_id = new.department_id
  limit 1;

  select full_name into vis_nm from public.visitors where id = new.visitor_id;

  if hod_id is not null then
    insert into public.notifications (recipient_id, type, title, body, related_id)
    values (
      hod_id,
      'visit_rejected',
      'No-show: ' || coalesce(vis_nm, 'Visitor') || ' did not arrive',
      'Visit ' || new.ref_number || ' has been marked as no-show. '
        || 'You can reactivate, reschedule, or close it.',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_no_show on public.visits;
create trigger trg_notify_no_show
  after update on public.visits
  for each row
  when (new.status = 'no_show' and old.status is distinct from new.status)
  execute function public.notify_no_show();
