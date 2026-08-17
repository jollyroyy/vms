-- ============================================================================
-- 094 — "Inactive" is a STATUS, not a role
--
-- The admin Settings screen gains a Users section (client instruction,
-- 2026-08-17: replicate GatePass's user administration here, and let it manage
-- `staff` as well as guard and hod). That screen has to answer "can this person
-- reach the app?" — and it must not answer it by rewriting `profiles.role`.
--
-- GatePass learned this the hard way (its migration 040). Suspending someone by
-- writing `role = 'staff'` destroyed the person's REAL role in the act of
-- suspending them, so reactivating meant an admin guessing what the account used
-- to be. In VMS the same trick is worse still: `staff` is a live role here with
-- its own routes (ROLE_ROUTES.staff — /visitors, /whos-inside, /reports), so
-- "deactivating" a guard that way would not shut them out at all. It would move
-- them sideways onto a different set of screens.
--
-- So the fact lives in its own table and the role column keeps holding a role.
--
-- HOW A SUSPENDED PERSON IS ACTUALLY SHUT OUT. Not by the client hiding a
-- screen — their JWT still says `guard`, and a JWT cannot be un-issued. The
-- flag is consulted by `public.current_user_role()`, which every RLS policy in
-- this database already goes through: it returns NULL for a suspended caller,
-- and every `in (...)` test below it evaluates to false rather than to a role.
-- One edit, and the rule holds for every policy that exists today and every
-- policy added later.
--
-- ABSENT ROW = ACTIVE. `is_user_active` coalesces to true, so every existing
-- account stays exactly as it is with no backfill, and a row is written only
-- when an admin actually suspends somebody.
--
-- NOTE ON THE SIBLING APP: GatePass has its own `gatepass.user_status` on this
-- same project and its own `gatepass.app_role()` gate. The two are deliberately
-- separate — suspending a person's VMS access is not a statement about their
-- GatePass access, and GatePass must never alter `public` (the 064 rule).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) The status table
-- ─────────────────────────────────────────────────────────────────────────────
-- Keyed on auth.users rather than public.profiles: this records something about
-- the ability to sign in and be authorized, and `on delete cascade` means
-- removing an account cannot leave a suspension behind that a recycled uuid
-- would inherit.
create table if not exists public.user_status (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  is_active      boolean not null default true,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now(),

  -- A suspension with no timestamp is a suspension nobody can date. The inverse
  -- is deliberately NOT constrained: reactivation clears both columns, but a
  -- legacy row that kept them stays readable rather than being rejected.
  constraint user_status_inactive_is_dated check (is_active or deactivated_at is not null)
);

comment on table public.user_status is
  'Whether an account may use VMS. Absent row means active. Written only by '
  'admin_deactivate_user / admin_reactivate_user (migration 096) — there is no '
  'insert/update/delete policy on purpose.';

alter table public.user_status enable row level security;

-- A person may see their own status; an admin sees everyone's (the Users
-- section's Status column). Nobody holds INSERT/UPDATE/DELETE — the two RPCs in
-- 096 are the only writers, the same shape the blacklist removal queue uses.
drop policy if exists "user_status: read own or admin" on public.user_status;
create policy "user_status: read own or admin"
  on public.user_status for select to authenticated
  using (user_id = auth.uid() or public.current_user_role() in ('admin', 'super_admin'));

grant select on public.user_status to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) The helper every gate reads
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the policy on user_status is never evaluated from inside
-- the function that decides that policy. It deliberately calls NOTHING: a
-- current_user_role() call here would recurse through the very policy this
-- function exists to answer.
create or replace function public.is_user_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.is_active from public.user_status s where s.user_id = p_user_id),
    true
  );
$$;

revoke all on function public.is_user_active(uuid) from public;
grant execute on function public.is_user_active(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) current_user_role() consults it
-- ─────────────────────────────────────────────────────────────────────────────
-- REBASED ON THE LIVE BODY (verified with pg_get_functiondef, 2026-08-17): 010
-- moved the source from `user_metadata` to `app_metadata`, and that is the copy
-- read here. The ONLY change is the surrounding CASE.
--
-- CREATE OR REPLACE, never DROP: this function is referenced by policies all
-- over this database, and a DROP would take every one of them with it (and
-- reset the ACL — see the CLAUDE.md trap).
--
-- It becomes SECURITY DEFINER because it now reads a table whose own policy
-- calls it. That costs the SQL inliner (a definer function is not inlined into
-- a policy expression), which is the price of the rule holding everywhere at
-- once rather than being retyped into forty policies.
--
-- A null `auth.uid()` — a cron session, the service role — reads as ACTIVE:
-- is_user_active finds no row and coalesces to true, so a scheduled sweep is
-- unaffected by this migration.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when public.is_user_active(auth.uid())
           then (auth.jwt() -> 'app_metadata' ->> 'role')::public.user_role
         end;
$$;

comment on function public.current_user_role() is
  'The caller''s role, or NULL when their account is suspended (migration 094). '
  'Every RLS policy in this schema reads it, so the suspension is enforced in '
  'Postgres rather than by a screen choosing not to render.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) What the app shell asks at startup
-- ─────────────────────────────────────────────────────────────────────────────
-- Modelled on 064's `my_must_change_password()`, and for the same reason: the
-- startup path must not `select ... from public.profiles`, a table with a
-- history of recursive-policy failures (42P17) where a raise would lock
-- everyone out or fail open silently.
--
-- Without this the suspension is enforced but ILLEGIBLE: the person still signs
-- in, still lands on their role's page, and every query on it returns nothing —
-- an app that shows a guard an empty gate is worse than one that tells them
-- their access has been withdrawn. App.tsx renders the message; this answers it.
create or replace function public.my_account_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_user_active(auth.uid());
$$;

revoke all on function public.my_account_active() from public;
grant execute on function public.my_account_active() to authenticated;

notify pgrst, 'reload schema';
