-- 057 — pre_approve_visitor: accept scheduled_for, and anchor the QR expiry to it.
--
-- Two bugs, one function.
--
-- 1. DRIFT. Migration 030 added a 7th parameter `p_scheduled_for` to this
--    function, but 030 was never applied to the live project — the live
--    definition audited 2026-08-01 still had the original 6 parameters.
--    src/pages/HOD/PreApproveForm.tsx sends `p_scheduled_for` whenever the HOD
--    picks a date, so PostgREST could not resolve an overload and every
--    future-dated pre-approval failed outright. (Another entry for the
--    055 ledger: 030 is applied *here*, not by its own file.)
--
-- 2. EXPIRY. visits.qr_expires_at defaults to `now() + 24h`, evaluated at
--    INSERT. Nothing ever overrode it — types/index.ts even Omits the column
--    from Insert — so a visit pre-approved for next Tuesday got a pass that
--    died on Wednesday. src/lib/qrToken.ts evaluateQrVisit checks expiry
--    BEFORE status, so the visitor arrived to "This QR code has expired."
--    A column default cannot reference a sibling column, so the anchor has to
--    be set here, at the insert.
--
-- Rebuilt from the LIVE definition, not from 030 on disk: the live function
-- carries JWT role and HOD-department authorization checks that 030's version
-- does not. Regenerating from the file would have silently dropped them and
-- let any authenticated user pre-approve for any department.

drop function if exists public.pre_approve_visitor(text, text, text, uuid, uuid, text);

create or replace function public.pre_approve_visitor(
  p_phone text,
  p_full_name text,
  p_company text,
  p_department_id uuid,
  p_host_id uuid,
  p_purpose text,
  p_scheduled_for timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visitor_id uuid;
  v_ref text;
  v_jwt_role text;
  v_jwt_dept_id uuid;
begin
  -- Only HOD / Admin / SuperAdmin may pre-approve (preserved from live).
  v_jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
  if v_jwt_role not in ('hod', 'admin', 'super_admin') then
    raise exception 'Only HOD or Admin can pre-approve visitors.';
  end if;

  -- HOD is scoped to their own department (preserved from live).
  if v_jwt_role = 'hod' then
    v_jwt_dept_id := (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid;
    if v_jwt_dept_id is null or v_jwt_dept_id <> p_department_id then
      raise exception 'You can only pre-approve visitors for your own department.';
    end if;
  end if;

  insert into public.visitors (phone, full_name, company)
  values (p_phone, p_full_name, nullif(p_company, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    company = coalesce(nullif(p_company, ''), visitors.company)
  returning id into v_visitor_id;

  -- qr_expires_at is anchored to the scheduled time when there is one, so a
  -- pass issued weeks ahead is still live when the visitor actually turns up.
  -- Walk-up pre-approvals (no schedule) keep the original 24h-from-now window.
  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material, scheduled_for, qr_expires_at
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved', false, p_scheduled_for,
    coalesce(p_scheduled_for, now()) + interval '24 hours'
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

-- DROP discards the old ACL, so restore the grants the live function had.
grant execute on function public.pre_approve_visitor(text, text, text, uuid, uuid, text, timestamptz)
  to public, authenticated, service_role;
