-- 061 — No-shows are decided at END OF DAY, and something actually runs the sweep.
--
-- TWO problems with what is live (052):
--
--   1. NOTHING EVER CALLED IT. `mark_no_shows()` has existed since 036 and is
--      live, but pg_cron was never installed on this project and no edge
--      function or client code invokes it. Every approved visit that was never
--      attended has therefore sat at `approved` forever. `select status,
--      count(*) from visits` on live returns zero `no_show` rows, which is the
--      proof, not an assumption.
--
--   2. The RULE WAS WRONG for how this site works. 052 marked a visit no-show
--      `grace_period_minutes` (default 30) after its slot — so a visitor booked
--      for 10:00 who turns up at 10:45 arrives to find their visit already
--      dead, mid-morning, while they are standing at the gate. A pre-approval
--      is good for the day it was booked for. It becomes a no-show when that
--      DAY ends, not 30 minutes after a nominal time.
--
-- TIMEZONE: the sweep is scheduled at 18:30 UTC, which is 00:00 IST — this is
-- an India deployment (ap-south-1, en-IN formatting, IN vehicle plates). The
-- rest of the app uses UTC day boundaries for its "today" windows; rather than
-- introduce a second, disagreeing notion of a day in SQL, the job simply runs
-- at the instant the Indian day ends and sweeps everything already past. That
-- keeps one rule — "its scheduled moment has gone" — and puts the timezone
-- decision in the schedule, where it is visible and adjustable in one place.

-- 1) End-of-day rule. Also now requires checked_in_at IS NULL: a visit that was
--    attended must never be reachable by this sweep, whatever its status has
--    since become. `status = 'approved'` alone relied on the status machine
--    never letting an attended visit back to approved — true today, but this is
--    a destructive bulk update and it should not depend on that.
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
    and scheduled_for < now()
    and checked_in_at is null
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

-- `grace_period_minutes` is deliberately NOT dropped. It is still on the table
-- and still honoured by the check-in expiry path; it simply no longer decides
-- no-show. Dropping a column to tidy up is not worth the migration risk.

-- 2) Actually schedule it.
create extension if not exists pg_cron with schema extensions;

-- Idempotent: unschedule first so a replay does not stack duplicate jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'mark-no-shows-daily') then
    perform cron.unschedule('mark-no-shows-daily');
  end if;
end;
$$;

-- 18:30 UTC = 00:00 IST. cron.schedule runs as the job owner (postgres), which
-- is not the service role, so the guard inside mark_no_shows() would reject it
-- on the JWT check — auth.jwt() is null in a cron session. Call the UPDATE
-- through a wrapper that is explicitly the scheduled path.
create or replace function public.sweep_no_shows_daily()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  update public.visits
  set status = 'no_show'
  where status = 'approved'
    and scheduled_for is not null
    and scheduled_for < now()
    and checked_in_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Not callable by users: the scheduler is the only caller, and the
-- role-scoped, department-scoped mark_no_shows() is the human entry point.
revoke all on function public.sweep_no_shows_daily() from public, authenticated, anon;

select cron.schedule(
  'mark-no-shows-daily',
  '30 18 * * *',
  $$select public.sweep_no_shows_daily();$$
);
