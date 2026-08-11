-- 071 — QR passes stop dying before the visit they were issued for.
--
-- 057 anchored `qr_expires_at` to `scheduled_for` and its header explains
-- exactly why: a pass booked on Monday for Wednesday died on Tuesday, and the
-- visitor arrived to "This QR code has expired." That fix was real — and it went
-- into `pre_approve_visitor`, which NOTHING CALLS. `PreApproveForm.tsx` calls
-- `pre_approve_visitor_v2`, which never mentions `qr_expires_at` at all, so
-- every pass it issues falls through to the column default of `now() + 24h`.
--
-- Live proof at the time of writing, straight off the table:
--
--   VIS-20260804-0023  scheduled 2026-08-26 20:05  qr_expires_at 2026-08-05 09:30
--
-- A pass for a visit three weeks away, dead twenty-one days before the visitor
-- turns up. Every booking made more than 24 hours ahead has this.
--
-- THE RULE, matching 066. A pass is good for the DAY it was issued for, and
-- expires when that day ends — not 24 hours after somebody happened to fill in
-- the form, and not at the scheduled minute either (a visitor 45 minutes late is
-- still a visitor who is coming). One rule now governs the status sweep, the
-- client's isVisitExpired, and the QR gate, so the three can no longer disagree
-- about whether a pass is live.

-- End of the IST day containing `ts`. Sibling of vms_day_start_ist().
create or replace function public.vms_day_end_ist(ts timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select (date_trunc('day', ts at time zone 'Asia/Kolkata') + interval '1 day')
         at time zone 'Asia/Kolkata';
$$;

grant execute on function public.vms_day_end_ist(timestamptz) to authenticated, service_role;

-- The default covers every insert path that does not name the column — the
-- walk-in lane, the kiosk, and any future writer. Anchoring it to the end of
-- today means a walk-in's pass and a walk-in's `expired` sweep agree by
-- construction rather than by two people remembering the same number.
alter table public.visits
  alter column qr_expires_at set default public.vms_day_end_ist(now());

-- SECURITY DEFINER, search_path and the volatility are re-stated deliberately:
-- CREATE OR REPLACE keeps the ACL but NOT these, so omitting them would silently
-- downgrade the function to SECURITY INVOKER and break it for every HOD.
create or replace function public.pre_approve_visitor_v2(
  p_phone text, p_full_name text, p_vendor_name text,
  p_department_id uuid, p_host_id uuid, p_purpose text,
  -- The `default null` is part of the existing signature; dropping it makes
  -- Postgres refuse the replace outright ("cannot remove parameter defaults").
  p_scheduled_for timestamptz default null
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
    carrying_material, scheduled_for, qr_expires_at
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved',
    false, p_scheduled_for,
    -- coalesce for safety only: validatePreApproval makes scheduled_for
    -- mandatory, so the fallback should be unreachable from the app.
    public.vms_day_end_ist(coalesce(p_scheduled_for, now()))
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

-- Backfill the passes that are still supposed to work. Deliberately scoped to
-- OPEN approvals: a finished visit's expiry is history and rewriting it would
-- edit the record of what happened.
update public.visits
set qr_expires_at = public.vms_day_end_ist(coalesce(scheduled_for, created_at))
where status in ('approved', 'walkin_approved')
  and checked_in_at is null;
