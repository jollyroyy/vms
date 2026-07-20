-- Fix infinite recursion in policies that subquery profiles:
--   department_id = (select department_id from public.profiles where id = auth.uid())
-- This triggered RLS on profiles → current_user_role() → infinite recursion on PG15+.
-- Fix: read department_id from the JWT user_metadata (synced by migration 004).

-- 1) visits: hod approves own department
drop policy if exists "visits: hod approves own department" on public.visits;
create policy "visits: hod approves own department"
  on public.visits for update to authenticated
  using (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid
  )
  with check (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid
  );

-- 2) gate_passes: hod approves own department
drop policy if exists "gate_passes: hod approves own department" on public.gate_passes;
create policy "gate_passes: hod approves own department"
  on public.gate_passes for update to authenticated
  using (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid
  )
  with check (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid
  );
