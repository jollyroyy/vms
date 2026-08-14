-- Migration 078 — demo-marker columns for the walkthrough seed.
-- The frontend demo seed (src/lib/demoSeed.ts) tags seed rows with
-- is_demo = true so the entire demo batch can be wiped in one click
-- without touching a single real record. Idempotent: safe to run twice.

alter table public.visitors
  add column if not exists is_demo boolean not null default false;

alter table public.visits
  add column if not exists is_demo boolean not null default false;

-- An index keeps countDemoVisits() and the clear action cheap on busy days.
create index if not exists idx_visits_demo on public.visits (is_demo, created_at);
