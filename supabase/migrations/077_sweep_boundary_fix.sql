-- 077 — close_stale_approvals boundary bug + nudge no-arg call (both from 075).
--
-- 1) THE SWEEP. 075 rewrote the boundary from vms_day_start_ist() (midnight IST —
--    "the day containing the visit's moment has ended") to
--    vms_day_end_ist(now()) (TODAY's 22:00 IST). The predicate
--    `scheduled_for < boundary` then means "scheduled before today's close",
--    which is true for every approval of the day from 00:01 IST on — the hourly
--    sweep filed a 6:30 PM visitor at 5:10 PM, twenty minutes before their slot
--    arrived (VIS-20260813-0001, live; the 13:10-16:10 IST runs swept the
--    security-test fixtures, which is why "1 row" appears all day yet only one
--    real row remains). The expired branch had the same disease:
--    `created_at < boundary` killed every walk-in created before today's close.
--
--    "The day containing this visit's moment has ended" with a 22:00 IST close
--    is a comparison against the END OF THE VISIT'S OWN DAY, not today's close:
--    `now() >= vms_day_end_ist(scheduled_for)`. True whenever evaluated,
--    idempotent, and no visitor is ever filed before their moment has passed —
--    which is also the industry rule (no VMS product marks a no-show before
--    the slot; see CLAUDE.md for the research).
create or replace function public.close_stale_approvals(p_all boolean, p_department uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n_no_show integer;
  n_expired integer;
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

  -- No appointment to miss; the approval simply lapsed. `created_at` is the
  -- moment the approval came into existence, so its day is the day it was good
  -- for — the same day the guard would have been looking for the visitor.
  update public.visits
  set status = 'expired'
  where status in ('approved','walkin_approved')
    and checked_in_at is null
    and scheduled_for is null
    and now() >= public.vms_day_end_ist(created_at)
    and (p_all or department_id = p_department);
  get diagnostics n_expired = row_count;

  return n_no_show + n_expired;
end;
$$;

-- The 073 lesson: CREATE FUNCTION grants EXECUTE to PUBLIC by default, which
-- the original ACL did not carry.
revoke all on function public.close_stale_approvals(boolean, uuid) from public, authenticated, anon;

-- 2) THE NUDGE. 075's body called `public.vms_day_end_ist()` with NO argument;
--    the function has always been one-argument (071). plpgsql defers resolution
--    to first execution, so CREATE succeeded and the hourly job has failed
--    with "function public.vms_day_end_ist() does not exist" since 075 landed
--    (verified in cron.job_run_details) — no host has been nudged since. One
--    argument, `now()`, fixes it; the body is otherwise byte-identical.
create or replace function public.nudge_overdue_visits(p_grace_minutes integer default 120)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  insert into public.notifications (recipient_id, type, title, body, related_id, is_read)
  select
    v.host_id,
    'visit_overdue',
    'Visitor has not arrived',
    coalesce(vis.full_name, 'Your visitor')
      || ' was expected at '
      || to_char(v.scheduled_for at time zone 'Asia/Kolkata', 'HH12:MI AM')
      || ' and has not checked in. The pass is still valid — they can arrive any time before 10 PM.',
    v.id,
    false
  from public.visits v
  join public.visitors vis on vis.id = v.visitor_id
  where v.status in ('approved','walkin_approved')
    and v.checked_in_at is null
    and v.scheduled_for is not null
    -- Late enough to be worth a message...
    and v.scheduled_for < now() - make_interval(mins => p_grace_minutes)
    -- ...but still a live day: scheduled today (070) and evaluated before close (075).
    and v.scheduled_for >= public.vms_day_start_ist()
    and now() < public.vms_day_end_ist(now())
    -- Exactly once per visit. Without this the job re-sends every hour for the
    -- rest of the day and the feed becomes noise the HOD learns to ignore.
    and not exists (
      select 1 from public.notifications n
      where n.related_id = v.id and n.type = 'visit_overdue'
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.nudge_overdue_visits(integer) from public, authenticated, anon;

-- 3) DATA REPAIR — rows the broken sweep filed before their moment arrived.
--    A legitimately-swept no_show has had its day END (22:00 IST of its own
--    day), so `now() < vms_day_end_ist(scheduled_for)` can only ever match
--    rows the bug filed early. And the no_show branch requires scheduled_for,
--    which the walk-in path never sets (066), so every such row came from
--    status 'approved'.
update public.visits
set status = 'approved'
where status = 'no_show'
  and now() < public.vms_day_end_ist(scheduled_for);