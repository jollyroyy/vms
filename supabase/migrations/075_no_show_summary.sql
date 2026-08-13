-- 075 — the no-show workflow, per the client (2026-08-13): the HOD hears about
-- today's no-shows at 8 PM, and the day closes at 10 PM.
--
-- THE WORKFLOW
--   1. 20:00 IST every day, each department HOD gets ONE summary:
--      "N approvals scheduled for today never arrived. They will be closed as
--      no-shows at 10 PM and the passes will become void." (Once per HOD per
--      IST day; the count is a forecast — nothing is marked yet.)
--   2. The IST day ends at 22:00 (mall close), not midnight. The first hourly
--      sweep run after close (~22:40) marks every un-arrived approval whose
--      moment fell before 22:00 as `no_show` (`expired` if it had no
--      scheduled_for), and the per-visit trigger tells the HOD the pass is now
--      void — a visitor who is still expected must be re-booked from scratch.
--   3. The `no_show -> approved` reactivation (066) stays as a DB-only safety
--      net for wrongly-swept rows; there is no UI for it, so an HOD who wants
--      the visitor back raises a new request — exactly the workflow above.
--
-- WHY THE DAY ENDS AT 22:00, NOT MIDNIGHT
--   `vms_day_end_ist()` used to mean "midnight of the next IST day". It now
--   means "22:00 IST of the day containing ts" — one constant that feeds the
--   QR expiry (071/073), the sweep boundary here, and the client mirror
--   (istDayEnd in src/lib/visitExpiry.ts), so the three still answer "is this
--   pass live?" the same way. Known edge, accepted: an approval booked AFTER
--   22:00 belongs to no day's window and is swept the following evening — the
--   mall is closed at that hour, so no visitor is affected.
--
-- Two notification types are added:
--   visit_no_show          — per-visit, from the existing trigger; the copy now
--                            says the pass is void and a new request is needed
--                            (it used to offer "reactivate, reschedule").
--   visit_no_show_summary  — the 20:00 count; related_id is NULL on purpose,
--                            it is a summary, not a single visit, so the
--                            Overview's "More information" never appears.

alter type public.notification_type add value if not exists 'visit_no_show';
alter type public.notification_type add value if not exists 'visit_no_show_summary';

-- 1) The day ends at 22:00 IST.
create or replace function public.vms_day_end_ist(ts timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select (date_trunc('day', ts at time zone 'Asia/Kolkata') + interval '22 hours')
         at time zone 'Asia/Kolkata';
$$;

comment on function public.vms_day_end_ist(timestamptz) is
  '22:00 IST of the day containing ts — the day ends at mall close (075). Sibling of vms_day_start_ist().';

grant execute on function public.vms_day_end_ist(timestamptz) to authenticated, service_role;

-- 2) The per-visit notification: correct type, correct copy.
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
      'visit_no_show',
      'No-show: ' || coalesce(vis_nm, 'Visitor') || ' did not arrive',
      'Visit ' || new.ref_number || ' was closed as a no-show at end of day. '
        || 'The pass is now void — if the visitor is still expected, raise a new pre-approval request.',
      new.id
    );
  end if;
  return new;
end;
$$;

-- 3) The sweep's boundary moves from midnight to close. The predicate still
--    means "the day containing this visit's moment has ENDED" (066) — the day
--    just ends at 22:00 now. `mark_no_shows()` and `sweep_no_shows_daily()`
--    are untouched; they already delegate here.
create or replace function public.close_stale_approvals(p_all boolean, p_department uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  boundary timestamptz := public.vms_day_end_ist(now());
  n_no_show integer;
  n_expired integer;
begin
  -- An appointment was made and missed.
  update public.visits
  set status = 'no_show'
  where status in ('approved','walkin_approved')
    and checked_in_at is null
    and scheduled_for is not null
    and scheduled_for < boundary
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
    and created_at < boundary
    and (p_all or department_id = p_department);
  get diagnostics n_expired = row_count;

  return n_no_show + n_expired;
end;
$$;

-- CREATE OR REPLACE keeps ACLs, but assert them anyway (073's lesson: check
-- \df+ after any RPC change).
revoke all on function public.close_stale_approvals(boolean, uuid) from public, authenticated, anon;
revoke all on function public.sweep_no_shows_daily() from public, authenticated, anon;

-- 4) The 20:00 IST forecast. Writes notifications only — nothing is marked
--    here; the sweep at close does that. `p_force` skips the once-per-IST-day
--    dedupe for verification/testing; the cron never sets it.
create or replace function public.send_no_show_summary(p_force boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  insert into public.notifications (recipient_id, type, title, body, related_id, is_read)
  select
    h.id,
    'visit_no_show_summary',
    'Expected visitors never arrived',
    s.n || ' approval' || case when s.n = 1 then '' else 's' end
      || ' in ' || coalesce(d.name, 'your department')
      || ' scheduled for today ' || case when s.n = 1 then 'has' else 'have' end
      || ' not arrived. ' || case when s.n = 1 then 'It will be closed as a no-show' else 'They will be closed as no-shows' end
      || ' at 10 PM and the pass' || case when s.n = 1 then '' else 'es' end
      || ' will become void. If the visitor is still expected, they can still check in at the gate until 10 PM.',
    null,
    false
  from (
    select v.department_id, count(*) as n
    from public.visits v
    where v.status in ('approved','walkin_approved')
      and v.checked_in_at is null
      and v.scheduled_for is not null
      -- Scheduled for today, before close. A slot that has not passed yet is
      -- still expected — it is exactly as likely to close as the rest.
      and v.scheduled_for >= public.vms_day_start_ist()
      and v.scheduled_for < public.vms_day_end_ist(now())
    group by v.department_id
  ) s
  join public.profiles h on h.department_id = s.department_id and h.role = 'hod'
  left join public.departments d on d.id = s.department_id
  where p_force or not exists (
    select 1 from public.notifications x
    where x.recipient_id = h.id
      and x.type = 'visit_no_show_summary'
      and x.created_at >= public.vms_day_start_ist()
  );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.send_no_show_summary(boolean) is
  'The 20:00 IST forecast: one notification per department HOD listing today''s un-arrived approvals that will close as no-shows at 22:00 IST. p_force skips the once-per-IST-day dedupe (testing only).';

revoke all on function public.send_no_show_summary(boolean) from public, authenticated, anon;

-- 20:00 IST == 14:30 UTC. Deliberately off the nudge (:15) and the sweep (:40)
-- so the three jobs never contend for the same rows in the same minute.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'no-show-summary-daily') then
    perform cron.unschedule('no-show-summary-daily');
  end if;
end;
$$;

select cron.schedule(
  'no-show-summary-daily',
  '30 14 * * *',
  $job$select public.send_no_show_summary();$job$
);

-- 5) The overdue nudge stops at close, not at midnight: after 22:00 a missed
--    visit is a post-mortem, not a nudge (and the sweep has usually filed it).
--    The body also promises "before 10 PM" instead of "any time today".
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
    and now() < public.vms_day_end_ist()
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

comment on function public.nudge_overdue_visits(integer) is
  'Notifies hosts of booked visitors who have not arrived. Writes notifications only — never visits.status. Stops at 22:00 IST (075): after close it is a post-mortem.';

revoke all on function public.nudge_overdue_visits(integer) from public, authenticated, anon;