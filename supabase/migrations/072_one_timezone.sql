-- 072 — the deployment's timezone lives in exactly one place.
--
-- 061 put it in the cron schedule (`30 18 * * *` = 18:30 UTC = 00:00 IST) and
-- left the SQL saying `scheduled_for < now()`. That worked only because the two
-- agreed: the rule was "everything already past", and it was only correct
-- BECAUSE it fired at the instant the Indian day ended. Two places, one
-- decision, no link between them — move the office to another timezone, or nudge
-- the schedule while debugging, and the rule silently changes meaning with no
-- error anywhere.
--
-- 066 made the predicate self-contained: `close_stale_approvals` asks whether
-- the day containing a visit's moment has ENDED, via `vms_day_start_ist()`. That
-- is true whenever it is evaluated, which makes the sweep idempotent and safe at
-- any hour — and it means the SCHEDULE NO LONGER CARRIES THE RULE. Keeping it
-- pinned to midnight only preserved the illusion that it did.
--
-- So the job runs hourly. `vms_day_start_ist()` is now the single definition of
-- the day boundary; the schedule decides only how promptly a finished day is
-- swept (within the hour), never what "finished" means. Changing the deployment's
-- timezone is now a one-line edit to that function, and every consumer —
-- close_stale_approvals, nudge_overdue_visits, vms_day_end_ist and through it
-- every QR expiry — follows automatically.
--
-- Cost of the extra runs: 23 more executions a day of a statement that matches
-- nothing 23 times. `visits` is small and the predicate is indexable.
--
-- The CLIENT half of this boundary is IST_OFFSET_MS in src/lib/visitExpiry.ts.
-- Those two are the pair to keep in step now; there is no third copy.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'mark-no-shows-daily') then
    perform cron.unschedule('mark-no-shows-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'sweep-no-shows-hourly') then
    perform cron.unschedule('sweep-no-shows-hourly');
  end if;
end;
$$;

-- :40, offset from nudge-overdue-visits-hourly at :15, so two jobs never contend
-- for the same rows in the same minute.
select cron.schedule(
  'sweep-no-shows-hourly',
  '40 * * * *',
  $job$select public.sweep_no_shows_daily();$job$
);

-- The name is now the only thing left saying "daily". Renaming a live function
-- means re-granting and re-pointing the job for no behavioural gain, so it keeps
-- its name and this comment carries the correction.
comment on function public.sweep_no_shows_daily() is
  'Closes stale approvals. Runs HOURLY as of 072 — idempotent, and the day boundary lives in vms_day_start_ist(), not in the schedule.';
