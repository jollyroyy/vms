-- 063 — audit_logs: client INSERT removed (forgery vector closed)
--
-- Public.audit_logs is the system's audit trail — who approved / rejected /
-- checked a visit in and out. A forgeable audit trail is no audit trail at
-- all, and this one WAS forgeable: migration 041 created
--
--   create policy "audit_logs: triggers can insert"
--     on public.audit_logs for insert to authenticated
--     with check (true);
--
--   grant select, insert on public.audit_logs to authenticated;
--
-- "with check (true)" means ANY signed-in user (a guard, a staff member,
-- anyone with an account) can POST to /rest/v1/audit_logs and fabricate a row:
-- arbitrary action, arbitrary user_id (the fabricated actor), arbitrary
-- entity_id, arbitrary details — even created_at, which the caller can pass
-- explicitly. The whole trail becomes evidence-free.
--
-- The policy's stated justification — "so the trigger's insert is not
-- refused" — was always wrong. Every function that writes audit_logs
-- (public.log_visit_approval, 041/043/044) is `security definer
-- set search_path = ''`, runs as the table owner, and therefore bypasses RLS
-- without needing any policy or grant. Nothing in the client app inserts into
-- audit_logs: Activity.tsx reads it, lib/visitActors.ts + visitApproval.ts read
-- it, and that is all.
--
-- Fix: drop the permissive insert policy and the INSERT grant. The audit trail
-- becomes writeable only by the DB itself (triggers) and by the service role
-- (fixtures/backfill), and the forgery surface disappears. SELECT and the
-- read policies (041 admin, 043 visit-scoped) are untouched.

drop policy if exists "audit_logs: triggers can insert" on public.audit_logs;

revoke insert on public.audit_logs from authenticated;

-- Nothing may ever re-grant client write access silently. The comment above
-- explains why the trigger does not need it; if a future migration adds a
-- client-written analytic row here, it must go through a SECURITY DEFINER
-- function, not through a table grant.