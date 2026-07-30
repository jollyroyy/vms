-- 055 — DRIFT RECONCILIATION 10/10: make a fresh replay converge on live state.
--
-- 046-054 brought the LIVE database up to what the files describe. This file
-- closes the other direction: places where the FILES are wrong and the live
-- database is right. Without this, replaying 001-055 onto a fresh project
-- (staging, DR, a new env) would end up with policies the production project
-- does not have — several of them wider than intended.
--
-- Every statement below is a DROP of a policy that only a from-scratch replay
-- can ever have created. Running this against the live project is a no-op.
--
-- ── 1) 022 broadened three SELECT policies to `using (true)` ────────────────
-- 043 already re-tightened visits/visitors/gate_passes/gate_pass_items. The one
-- 043 did not cover is profiles: 022 creates "profiles: all authenticated can
-- read", which a replay would leave sitting alongside the correct, department
-- scoped "profiles: read scoped by role" from 040. A permissive policy ORs with
-- its siblings, so the open one wins and every user can read every profile.
drop policy if exists "profiles: all authenticated can read" on public.profiles;

-- ── 2) 022's visitors UPDATE policy was superseded by 028 ───────────────────
-- Live has only "visitors: guard/hod/admin can update". A replay would ALSO
-- create 022's narrower-named "visitors: guard/admin can update"; harmless in
-- effect but it is schema noise that makes the next audit harder.
drop policy if exists "visitors: guard/admin can update" on public.visitors;

-- ── 3) 022's visits UPDATE policies were superseded ─────────────────────────
-- Live grants the guard UPDATE via "visits: guard updates checkin/checkout".
-- 022 drops that and creates "visits: guard updates status" instead. Converge
-- on the live name, and re-assert it in case a replay dropped it.
drop policy if exists "visits: guard updates status" on public.visits;
drop policy if exists "visits: guard updates checkin/checkout" on public.visits;
create policy "visits: guard updates checkin/checkout"
  on public.visits for update to authenticated
  using (public.current_user_role() = 'guard')
  with check (public.current_user_role() = 'guard');

drop policy if exists "visits: admin updates any" on public.visits;
create policy "visits: admin updates any"
  on public.visits for update to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

-- ── 4) HODs deliberately have NO direct UPDATE on visits ────────────────────
-- 022 creates "visits: hod updates own department", which was never applied
-- here. It should stay unapplied: every HOD write to a visit goes through a
-- security-definer RPC — approve_visit (015), reject_visit (015) and
-- cancel_visit (045) — so a direct UPDATE grant adds attack surface without
-- enabling any feature. Audited src/ for this: the only `.from('visits')
-- .update(...)` call sites are guard-role paths (CheckInPanel.tsx:160,
-- Console.tsx:77, Kiosk.tsx:159, VisitorForm.tsx:132). Dropped so a replay
-- cannot silently widen HOD write access.
drop policy if exists "visits: hod updates own department" on public.visits;

-- HOD's one legitimate direct write is the pre-approval INSERT. Re-assert it.
drop policy if exists "visits: hod pre-approves own department" on public.visits;
create policy "visits: hod pre-approves own department"
  on public.visits for insert to authenticated
  with check (
    public.current_user_role() = 'hod'
    and department_id = (auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid
    and status = 'approved'
  );

-- ── 5) 002's combined settings write policy was split into INSERT + UPDATE ──
drop policy if exists "settings_write_admin" on public.settings;

-- ── 6) Audit ledger ─────────────────────────────────────────────────────────
-- Live-vs-disk audit of project oxzzeonftrmohdrancex, 2026-07-30.
-- supabase_migrations.schema_migrations recorded 12 of 45 files; the 3-digit
-- filename prefixes are not CLI-recognisable versions, so this project has
-- always been migrated by hand and the history table was never authoritative.
--
--   NEVER APPLIED, now reconciled : 020 (050), 021 cols (047), 024 (048),
--                                   033 (047+053), 035 (051), 036 (046+047+052),
--                                   039 (054)
--   PARTIALLY APPLIED             : 022 — fn/trigger restored in 051, policy
--                                   convergence here; 032 — trigger fn was
--                                   live, table/type/policies added in 049
--   FILES INTENTIONALLY NOT REPLAYED:
--     * 021's pre_approve_visitor(…p_vehicle_number…) — superseded by 026/029
--       and the live pre_approve_visitor / pre_approve_visitor_v2 pair.
--     * 022's "visits: hod updates own department" — see section 4.
--
--   FIXED WHILE RECONCILING (the file was buggy, not just unapplied):
--     * 035 read OLD.* in a BEFORE INSERT trigger -> would raise
--       `record "old" is not assigned yet` on every visit INSERT. (051)
--     * 020's check_login_rate_limit was not security definer, so RLS made it
--       always count 0 and never rate-limit. (050)
--     * 032's gate_signoffs policies were `true`/`true` — forgeable inserts and
--       cross-department reads. (049)
--     * 036's no-show notify trigger had no WHEN clause and its sweep RPC was
--       executable by any authenticated user. (052)
--
--   KNOWN REMAINING, deliberately untouched: the unused `gatepass` schema still
--   has gatepass.gate_passes in the supabase_realtime publication (noted in
--   043's header). Dropping it is destructive and out of scope for this pass.
