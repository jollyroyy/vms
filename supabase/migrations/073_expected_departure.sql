-- 073 — `visits.expected_departure`: the schema learns that some visits are long.
--
-- 067 installed an overstay rule ("inside more than N hours") and deliberately
-- left it unscheduled, because there was no way to tell a contractor who is
-- legitimately on site for two days from a check-out somebody forgot. Any fixed
-- threshold is wrong for one of those two, and guessing is not a design.
--
-- This is the missing fact. An HOD raising a pre-approval already knows whether
-- they are booking a 30-minute meeting or a three-day installation; nothing in
-- the schema let them say so, so the sweep had to infer it and could not.
--
--   expected_departure IS NULL  ->  ordinary visit, threshold is checked_in_at + N hours
--   expected_departure IS SET   ->  the HOD said when they leave; that IS the deadline
--
-- Optional on purpose. Making it required would put a second mandatory datetime
-- in front of every routine meeting to serve the minority case, and an HOD who
-- does not know the answer would type something false — which is worse than null,
-- because null is honest about not knowing.

alter table public.visits
  add column if not exists expected_departure timestamptz;

comment on column public.visits.expected_departure is
  'When the approver expects this visitor to leave. Null means ordinary visit; the overstay rule then falls back to a fixed interval from check-in.';

-- A departure before the arrival is not a long visit, it is a typo. Checked in
-- the database rather than only on the form, because the form is a usability
-- guard that any token can skip by calling PostgREST directly — the same
-- reasoning as migration 062.
alter table public.visits
  drop constraint if exists visits_departure_after_arrival;

alter table public.visits
  add constraint visits_departure_after_arrival
  check (
    expected_departure is null
    or scheduled_for is null
    or expected_departure > scheduled_for
  );

-- The overstay rule now asks a deadline, not an interval.
--
-- coalesce puts the HOD's answer first and falls back to the fixed interval only
-- when they did not give one, so a booked three-day visit is quiet for three
-- days and then reports exactly once — the day it actually runs over.
create or replace function public.sweep_overstays(p_hours integer default 12)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  update public.visits
  set status = 'checked_out',
      checked_out_at = now(),
      exit_verified = false
  where status = 'checked_in'
    and checked_in_at is not null
    and now() > coalesce(
          expected_departure,
          checked_in_at + make_interval(hours => p_hours)
        );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.sweep_overstays(integer) from public, authenticated, anon;

-- DROP + CREATE, not CREATE OR REPLACE: adding a parameter makes a new function
-- rather than replacing the old one, and PostgREST would then see two
-- overloads and refuse the call as ambiguous. 059 hit the same wall renaming a
-- parameter. The ACL does NOT survive a drop, so the grants are re-stated below
-- exactly as they were (postgres/anon/authenticated/service_role EXECUTE).
drop function if exists public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz);

create function public.pre_approve_visitor_v2(
  p_phone text, p_full_name text, p_vendor_name text,
  p_department_id uuid, p_host_id uuid, p_purpose text,
  p_scheduled_for timestamptz default null,
  p_expected_departure timestamptz default null
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_visitor_id uuid;
  v_ref text;
begin
  insert into public.visitors (phone, full_name, vendor_name)
  values (p_phone, p_full_name, nullif(p_vendor_name, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    vendor_name = coalesce(nullif(p_vendor_name, ''), visitors.vendor_name)
  returning id into v_visitor_id;

  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material, scheduled_for, expected_departure, qr_expires_at
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved',
    false, p_scheduled_for, p_expected_departure,
    -- The pass has to outlive the visit it authorises. For a multi-day booking
    -- that means the end of the DEPARTURE day, not the arrival day — otherwise
    -- a three-day contractor's QR dies on night one, which is 071's bug with a
    -- longer fuse.
    public.vms_day_end_ist(coalesce(p_expected_departure, p_scheduled_for, now()))
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

grant execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz, timestamptz)
  to postgres, anon, authenticated, service_role;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which the dropped
-- function did NOT carry. Left in place this would silently widen the ACL as a
-- side effect of adding a parameter. Revoked to restore the original exactly.
revoke execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz, timestamptz)
  from public;
