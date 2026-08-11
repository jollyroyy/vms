-- 067 — visits that were never checked out get closed, and stay marked as such.
--
-- THE PROBLEM. `visits.status = 'checked_in'` is the only thing that answers
-- "who is on the premises right now", and that list is what gets handed to a
-- fire marshal. Nothing ever closed a visit the guard forgot to check out, so
-- the answer drifts wrong in one direction only — permanently over-counting.
-- Live at the time of writing: one visitor checked in at 13:05 IST on 2026-08-10
-- and still reading as inside 22 hours later.
--
-- It also blocks that visitor forever. Migration 060 put a partial unique index
-- on visits(visitor_id) where status = 'checked_in', so one uncleared row means
-- that phone number can never check in again — activeVisit.ts will keep telling
-- the guard "already inside" about someone standing in front of them.
--
-- THE RULE. A visit still open `p_hours` after check-in is closed. Duration, not
-- wall clock: a fixed 23:59 sweep is wrong for anyone who works a night shift,
-- which is exactly the population that generates overnight visits here. This is
-- the same reason Envoy sells "N hours after entry" as the escalation from its
-- default midnight sign-out.
--
-- WHY exit_verified = false IS THE WHOLE POINT. An auto-close must never be
-- indistinguishable from a guard watching someone leave. `Console.logExit` sets
-- exit_verified = true; this sets it false. So the column now means precisely
-- "did a human witness this exit", and a report that says
--
--     Checked out 23:59  (exit not verified)
--
-- is true, whereas a bare "Checked out 23:59" would be the system laundering
-- "we lost track of this person" into a fact about where they went. `checked_out_at`
-- is the moment we gave up, not the moment they left, and nothing should read it
-- as the latter without also reading exit_verified.
--
-- NOT MERGED INTO sweep_no_shows_daily. Different question (arrived and never
-- closed vs never arrived), different cadence (hourly vs daily), different
-- rule. Folding them together would mean one of the two silently inherits the
-- other's schedule the next time either is tuned — which is how 061's fix
-- reached only one of its two call paths.

create or replace function public.sweep_overstays(p_hours integer default 12)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  -- A cron session carries no JWT, so is_service_role() is false and
  -- enforce_visit_update_rules would reject the checked_in -> checked_out
  -- transition as "Only the guard can log check-out." Transaction-local, so it
  -- cannot leak onto anything else using this connection. Same reasoning as 061.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  update public.visits
  set status = 'checked_out',
      checked_out_at = now(),
      exit_verified = false
  where status = 'checked_in'
    and checked_in_at is not null
    and checked_in_at < now() - make_interval(hours => p_hours);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.sweep_overstays(integer) is
  'Closes visits still checked_in after p_hours, with exit_verified = false so an auto-close is never mistaken for a witnessed exit.';

-- The scheduler is the only caller. A guard who wants someone out checks them
-- out properly, from the Inside tab, which records a verified exit.
revoke all on function public.sweep_overstays(integer) from public, authenticated, anon;

-- DELIBERATELY NOT SCHEDULED (decision, 2026-08-11).
--
-- The function is installed and ready; no cron job calls it. The guard's
-- "Overstaying" dashboard tile is the live mechanism instead, and it is the
-- better one: a guard who sees the tile and checks the visitor out records
-- `exit_verified = true` — a real exit, witnessed by a human. This sweep can
-- only ever record `exit_verified = false`, which is an admission rather than
-- an observation. Prefer the admission last, not first.
--
-- Turn it on when the tile proves it is not enough — the whole job is one line,
-- and the threshold lives in it for the same reason 061 put the timezone in the
-- schedule: one visible place to change it, no redeploy.
--
--   select cron.schedule(
--     'sweep-overstays-hourly',
--     '5 * * * *',
--     $job$select public.sweep_overstays(12);$job$
--   );
--
-- Hourly, not nightly, when it is enabled: the rule is "N hours after entry", so
-- the job has to run more often than the interval it enforces or the effective
-- threshold silently becomes "N hours, rounded up to the next run".
