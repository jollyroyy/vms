-- 047 — DRIFT RECONCILIATION 2/10: columns declared on disk but missing live.
--
-- Two of these are live bugs, not just replay hygiene — the app already reads
-- and writes them against columns that do not exist:
--   * profiles.avatar_url   — src/components/layout/SidebarProfile.tsx:31 selects
--                             it and :58 updates it. Avatar upload fails today.
--   * visitors.vehicle_number — src/pages/Guard/VisitorForm.tsx:169 updates it.
--                             Entering a vehicle number fails today.
--
-- The rest are declared in 021/032/036 and are referenced by src/types/index.ts
-- (Visit.grace_period_minutes, GatePass.verified_vehicle) but not yet queried.
-- They are added now so the type definitions and the schema agree.
--
-- NOTE: 021_visit_consent_fields.sql also redefines public.pre_approve_visitor
-- with a p_vehicle_number argument. That is deliberately NOT replayed here:
-- migrations 026 and 029 superseded it, and the live database has the correct
-- pre_approve_visitor/pre_approve_visitor_v2 pair. Re-applying 021's version
-- would regress the RPC. See 055.

-- ── 021: consent / emergency-contact fields ─────────────────────────────────
alter table public.visitors
  add column if not exists vehicle_number text;

alter table public.visits
  add column if not exists emergency_contact_name     text,
  add column if not exists emergency_contact_phone    text,
  add column if not exists expected_duration_minutes  int,
  add column if not exists consent_privacy            boolean not null default false,
  add column if not exists consent_site_rules         boolean not null default false,
  add column if not exists nda_signature              text,
  add column if not exists privacy_signature          text,
  add column if not exists site_rules_signature       text;

-- ── 033: profile avatar ─────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text;

-- ── 036: per-visit no-show grace period ─────────────────────────────────────
alter table public.visits
  add column if not exists grace_period_minutes integer not null default 30;

-- ── 032: vehicle recorded by the guard at gate sign-off ─────────────────────
alter table public.gate_passes
  add column if not exists verified_vehicle text;
