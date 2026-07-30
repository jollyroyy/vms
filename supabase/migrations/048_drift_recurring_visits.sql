-- 048 — DRIFT RECONCILIATION 3/10: recurring_visits table (from 024).
--
-- LIVE BUG: src/pages/Guard/CheckInPanel.tsx:61 queries
-- `.from('recurring_visits')`, but the table has never existed on this project.
-- Every guard check-in that consults the recurring-visitor list errors out.
-- src/types/index.ts:223 also declares the table in the Database type.
--
-- Reproduced verbatim from 024_recurring_visits.sql, with two changes:
--   * schema-qualified (024 relied on the default search_path)
--   * policies wrapped in `drop policy if exists` so this file is replayable

create table if not exists public.recurring_visits (
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid not null references public.departments(id) on delete cascade,
  host_id         uuid not null references public.profiles(id),
  created_by      uuid not null references public.profiles(id),

  -- Visitor identity (pre-registered)
  visitor_name    text not null,
  visitor_phone   text not null,
  visitor_company text,
  purpose         text not null default 'maintenance',

  -- Recurrence pattern
  recurrence_type text not null check (recurrence_type in ('daily', 'weekly', 'monthly')),
  recurrence_day  integer,          -- 0=Sunday..6=Saturday for weekly; 1-31 for monthly
  start_date      date not null,
  end_date        date,             -- null = no end

  -- State
  is_active       boolean not null default true,
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.recurring_visits enable row level security;

-- HOD sees their own department's series; admin sees all.
drop policy if exists "hod_select_recurring" on public.recurring_visits;
create policy "hod_select_recurring" on public.recurring_visits
  for select to authenticated using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('hod', 'admin', 'super_admin')
    and (
      (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
      or department_id::text = (auth.jwt() -> 'app_metadata' ->> 'department_id')
    )
  );

drop policy if exists "hod_insert_recurring" on public.recurring_visits;
create policy "hod_insert_recurring" on public.recurring_visits
  for insert to authenticated with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('hod', 'admin', 'super_admin')
    and (
      (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
      or department_id::text = (auth.jwt() -> 'app_metadata' ->> 'department_id')
    )
  );

drop policy if exists "hod_update_recurring" on public.recurring_visits;
create policy "hod_update_recurring" on public.recurring_visits
  for update to authenticated using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('hod', 'admin', 'super_admin')
    and (
      (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
      or department_id::text = (auth.jwt() -> 'app_metadata' ->> 'department_id')
    )
  );

-- The guard console reads this list at check-in (CheckInPanel.tsx:61). 024 gave
-- SELECT to hod/admin only, which would leave that query returning zero rows for
-- the one role that actually consumes it. Add a guard-scoped read policy.
drop policy if exists "guard_select_recurring" on public.recurring_visits;
create policy "guard_select_recurring" on public.recurring_visits
  for select to authenticated using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('guard', 'admin', 'super_admin')
  );

comment on table public.recurring_visits is
  'Recurring visitor series — generates visits on a schedule.';
