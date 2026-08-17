-- 084 — entry points: WHERE a visitor came through.
--
-- The admin Reports screen asks for "Entry Point Utilization" — how the day's
-- arrivals split across Reception A, Reception B, Gate 1, Gate 2. Nothing in
-- the schema could answer it. "Desk" in the app's own vocabulary
-- (lib/visitOrigin.ts) means pre-approved vs walk-in — WHICH ROUTE a visitor
-- took, never WHICH DOOR — so it is not the same question and cannot be
-- borrowed for it.
--
-- A TABLE, not a text column on visits, and not an enum. The mall opens and
-- closes doors; a free-text column would spell one gate four ways within a
-- month and the utilization panel would show four gates. An enum would need a
-- migration every time a door opens. A table with an `active` flag lets a
-- closed gate keep its history while dropping out of the picker.
--
-- `visits.entry_point_id` is NULLABLE and stays that way. Every visit that
-- already exists came through a door nobody recorded, and inventing one for
-- them would put a fabricated location on a record someone may later be asked
-- to account for. The utilization panel counts what it knows and says how many
-- it does not.

create table if not exists public.entry_points (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null,
  -- 'reception' | 'gate'. Free text with a CHECK rather than an enum type:
  -- adding a kind must not require a type alter and a dependent-view rebuild.
  kind        text not null default 'gate',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Same allowlist shape as migration 062's department rules: these are short
-- structured identifiers typed by an admin, not prose.
alter table public.entry_points drop constraint if exists entry_points_name_format;
alter table public.entry_points add constraint entry_points_name_format
  check (name ~ '^[A-Za-z0-9 &./''-]{2,60}$');

alter table public.entry_points drop constraint if exists entry_points_code_format;
alter table public.entry_points add constraint entry_points_code_format
  check (code ~ '^[A-Z0-9&-]{1,10}$');

alter table public.entry_points drop constraint if exists entry_points_kind_valid;
alter table public.entry_points add constraint entry_points_kind_valid
  check (kind in ('reception', 'gate'));

create unique index if not exists entry_points_code_key on public.entry_points (code);

alter table public.visits
  add column if not exists entry_point_id uuid references public.entry_points(id);

-- The utilization panel groups by this column over a date window; without the
-- index it is a sequential scan of every visit ever made.
create index if not exists visits_entry_point_idx
  on public.visits (entry_point_id) where entry_point_id is not null;

-- ── Seed ────────────────────────────────────────────────────────────────────
-- The four doors the client's reference screen names. Seeded rather than left
-- empty because an entry-point picker with nothing in it makes the guard's
-- check-in unable to record the one fact this migration exists to capture.
-- `on conflict do nothing` keeps this idempotent and never overwrites a name
-- an admin has since corrected.
insert into public.entry_points (name, code, kind, sort_order) values
  ('Reception A', 'RECA', 'reception', 1),
  ('Reception B', 'RECB', 'reception', 2),
  ('Gate 1',      'GATE1', 'gate',     3),
  ('Gate 2',      'GATE2', 'gate',     4)
on conflict (code) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.entry_points enable row level security;

-- Every signed-in role reads them: the guard picks one at check-in, the admin
-- reports on them, the HOD sees which door their visitor used.
drop policy if exists "entry_points: authenticated read" on public.entry_points;
create policy "entry_points: authenticated read"
  on public.entry_points for select
  to authenticated
  using (true);

-- Only an admin opens or closes a door. There is no delete policy on purpose —
-- deleting an entry point would orphan every visit that came through it, so the
-- `active` flag is the retirement mechanism.
drop policy if exists "entry_points: admin writes" on public.entry_points;
create policy "entry_points: admin writes"
  on public.entry_points for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "entry_points: admin updates" on public.entry_points;
create policy "entry_points: admin updates"
  on public.entry_points for update
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
