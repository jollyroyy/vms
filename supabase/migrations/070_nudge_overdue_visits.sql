-- 070 — the overdue nudge: chase the host, never touch the visit.
--
-- This is the ONE place a grace period belongs, and the reason it is safe here
-- is that it writes to `notifications` and nothing else. 052 put a grace period
-- on `visits.status` and it killed passes while visitors were still travelling;
-- 061 removed it. The instinct behind it was sound — somebody should know when a
-- booked visitor has not turned up — it was the CONSEQUENCE that was wrong.
--
--   overdue  ->  a message to the host.        Reversible: they arrive, it stops mattering.
--   no_show  ->  a terminal status at day end. Not reversible without an HOD.
--
-- A visit that is overdue stays fully checkable-in. Nothing in this migration
-- writes to `visits`, and nothing in it should ever be made to.
--
-- WHY IN-APP AND NOT EMAIL. The notify-host edge function exists and sends mail
-- through Resend, but Postgres cannot reach it: `pg_net` is not installed on
-- this project, so there is no way to make an HTTP call from a scheduled job.
-- The `notifications` table and the HOD Overview feed that reads it are already
-- live, so the nudge goes there. To add email later, install pg_net and have
-- this job POST to an edge function as well — the row it inserts here is the
-- natural payload, and inserting it first keeps the two in step.

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
      || ' and has not checked in. The pass is still valid — they can arrive any time today.',
    v.id,
    false
  from public.visits v
  join public.visitors vis on vis.id = v.visitor_id
  where v.status in ('approved','walkin_approved')
    and v.checked_in_at is null
    and v.scheduled_for is not null
    -- Late enough to be worth a message...
    and v.scheduled_for < now() - make_interval(mins => p_grace_minutes)
    -- ...but still good today. Past the day boundary this is no longer a nudge,
    -- it is a post-mortem, and the nightly sweep has already filed it as a
    -- no-show. Sending both would tell the host twice about one absence.
    and v.scheduled_for >= public.vms_day_start_ist()
    -- Exactly once per visit. Without this the job re-sends every hour for the
    -- rest of the day and the feed becomes noise the HOD learns to ignore —
    -- which costs them the notification that actually matters.
    and not exists (
      select 1 from public.notifications n
      where n.related_id = v.id and n.type = 'visit_overdue'
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.nudge_overdue_visits(integer) is
  'Notifies hosts of booked visitors who have not arrived. Writes notifications only — never visits.status.';

-- The scheduler is the only caller; there is no human reason to fire this.
revoke all on function public.nudge_overdue_visits(integer) from public, authenticated, anon;

-- Hourly at :15, deliberately offset from any other job so two sweeps never
-- contend for the same rows in the same minute.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'nudge-overdue-visits-hourly') then
    perform cron.unschedule('nudge-overdue-visits-hourly');
  end if;
end;
$$;

-- The grace period lives HERE, in the job's command, next to the schedule that
-- decides how promptly it is honoured — one visible place to change it.
select cron.schedule(
  'nudge-overdue-visits-hourly',
  '15 * * * *',
  $job$select public.nudge_overdue_visits(120);$job$
);
