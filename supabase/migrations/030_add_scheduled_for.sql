-- 030 — Add scheduled_for column for future-dated pre-approvals
alter table public.visits add column if not exists scheduled_for timestamptz;

create index if not exists idx_visits_scheduled_for on public.visits (scheduled_for);

-- Update security definer RPC to accept optional scheduled_for
drop function if exists public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text);

create or replace function public.pre_approve_visitor_v2(
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
begin
  insert into public.visitors (phone, full_name, company)
  values (p_phone, p_full_name, nullif(p_company, ''))
  on conflict (phone) do update set
    full_name = p_full_name,
    company = coalesce(nullif(p_company, ''), visitors.company)
  returning id into v_visitor_id;

  insert into public.visits (
    visitor_id, department_id, host_id, purpose, status,
    carrying_material, scheduled_for
  ) values (
    v_visitor_id, p_department_id, p_host_id, p_purpose::public.visitor_purpose,
    'approved',
    false, p_scheduled_for
  )
  returning ref_number into v_ref;

  return json_build_object('ref_number', v_ref);
end;
$$;

revoke execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz) from anon, public;
grant execute on function public.pre_approve_visitor_v2(text, text, text, uuid, uuid, text, timestamptz) to authenticated;
