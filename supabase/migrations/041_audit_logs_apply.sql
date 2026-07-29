-- 041 — Create audit_logs for real.
--
-- Sections 9 and 10 of migration 022 (the audit_logs table, its policies and the
-- visits trigger) were never applied to the live database, so /admin/activity
-- failed with:
--   "Could not find the table 'public.audit_logs' in the schema cache"
--
-- Two corrections against 022 while re-applying it:
--   * user_id is nullable. 022 declared it `not null references profiles(id)`,
--     which meant any status change made without a JWT (service role, scheduled
--     auto-checkout) would fail the insert and take the whole visit UPDATE down
--     with it. A system action is now logged with a null actor.
--   * the approval branch also matches plain 'approved'. 022 only logged
--     'walkin_approved', so an ordinary HOD approval — the most common action in
--     the system — was never recorded.

create table if not exists public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

alter table public.audit_logs alter column user_id drop not null;
alter table public.audit_logs enable row level security;

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

drop policy if exists "audit_logs: admin can read" on public.audit_logs;
create policy "audit_logs: admin can read"
  on public.audit_logs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));

-- Rows are written by the security-definer trigger below, never by the client.
-- The permissive check exists only so the trigger's insert is not refused.
drop policy if exists "audit_logs: triggers can insert" on public.audit_logs;
create policy "audit_logs: triggers can insert"
  on public.audit_logs for insert to authenticated
  with check (true);

create or replace function public.log_visit_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if new.status in ('approved', 'walkin_approved') and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_approved', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'status', new.status));
  elsif new.status = 'rejected' and old.status = 'pending_approval' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_rejected', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number, 'reason', new.rejection_reason));
  elsif new.status = 'checked_in' and old.status in ('approved', 'walkin_approved') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_checked_in', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number));
  elsif new.status = 'checked_out' and old.status = 'checked_in' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (actor, 'visit_checked_out', 'visit', new.id,
      jsonb_build_object('ref_number', new.ref_number));
  end if;
  return new;
end;
$$;

drop trigger if exists log_visit_changes on public.visits;
create trigger log_visit_changes
  after update on public.visits
  for each row when (old.status is distinct from new.status)
  execute function public.log_visit_approval();

grant select, insert on public.audit_logs to authenticated;
revoke update, delete on public.audit_logs from authenticated;
