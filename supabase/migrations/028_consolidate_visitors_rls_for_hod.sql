-- 028 — Consolidate visitors INSERT + UPDATE policies for HOD
--
-- Problem: 026 used public.current_user_role() in INSERT which can fail
-- in certain execution contexts. 027 added HOD to UPDATE but the INSERT
-- policy may still be stale. This migration drops ALL visitors INSERT and
-- UPDATE policies and recreates them using auth.jwt() directly (proven
-- safe by 022 for UPDATE).

-- ── INSERT ───────────────────────────────────────────────────────────────────
drop policy if exists "visitors: guard/admin can insert" on public.visitors;
drop policy if exists "visitors: guard/hod/admin can insert" on public.visitors;

create policy "visitors: guard/hod/admin can insert"
  on public.visitors for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('guard', 'hod', 'admin', 'super_admin')
  );

-- ── UPDATE ───────────────────────────────────────────────────────────────────
drop policy if exists "visitors: guard/admin can update" on public.visitors;
drop policy if exists "visitors: guard/hod/admin can update" on public.visitors;

create policy "visitors: guard/hod/admin can update"
  on public.visitors for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('guard', 'hod', 'admin', 'super_admin')
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('guard', 'hod', 'admin', 'super_admin')
  );
