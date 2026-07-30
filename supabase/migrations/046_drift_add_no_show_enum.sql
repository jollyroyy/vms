-- 046 — DRIFT RECONCILIATION 1/10: add the `no_show` visit_status enum value.
--
-- Context: an audit of the live project (oxzzeonftrmohdrancex) against the
-- migration files on disk found that migrations 020, 021, 024, 032 (partly),
-- 033, 035, 036 and 039 were never applied — only 12 of 45 files are recorded
-- in supabase_migrations.schema_migrations. Migrations 046-055 reconcile the
-- live database to the state the files describe. See 055 for the full audit
-- ledger and for the two places where the FILES were wrong, not the database.
--
-- This value is declared in 036_no_show.sql but is absent from the live enum,
-- while src/ already reads it in eight places (src/types/index.ts,
-- src/lib/statusStyles.ts, src/lib/visitLifecycle.ts, src/lib/visitStatusLabel.ts,
-- src/pages/Shared/Reports.tsx, src/pages/Guard/Console.tsx, ...).
--
-- ALTER TYPE ... ADD VALUE must be committed before the new label can be
-- referenced by any function body or DML. That is why this is a migration of
-- its own: 051 and 052 depend on it having already landed.

alter type public.visit_status add value if not exists 'no_show';
