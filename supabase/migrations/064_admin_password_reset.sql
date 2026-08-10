-- ============================================================================
-- 064 — Admin-assisted password reset, and a forced change on first sign-in
--
-- Self-service reset was removed from the login card (2026-08-10): the built-in
-- Supabase email sender is capped at ~2 mails/hour PROJECT-WIDE (shared with
-- GatePass), so the "Forgot password?" button failed for most people who used
-- it. The replacement is a human: the admin resets it from the Admin Panel.
--
-- That needs two things the browser cannot do on its own:
--   1. write another user's password — auth.admin.updateUserById needs the
--      service-role key, which must NEVER reach the bundle;
--   2. remember that the password is a TEMPORARY one the admin knows, so the
--      user is made to choose their own before they can use the app.
--
-- Both live here as SECURITY DEFINER functions, the same shape GatePass's
-- admin_create_user already uses to write auth.users (bcrypt via
-- extensions.crypt / gen_salt('bf') — verified live 2026-08-08, GoTrue accepts
-- a hash written this way and the account signs in normally).
--
-- public.profiles is VMS-owned and SHARED with GatePass, so the flag is added
-- here, once, and GatePass reads it. GatePass must never alter public.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) The flag
-- ─────────────────────────────────────────────────────────────────────────────
-- NOT NULL DEFAULT false: every existing account is unaffected, and only an
-- explicit admin reset (or a future invite path) can raise it. Nullable would
-- make "never reset" and "reset, unknown state" indistinguishable at the one
-- moment the answer decides whether to block someone out of the app.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True while the account is on an administrator-set temporary password. The app '
  'blocks every screen until public.set_my_password() clears it. Shared with GatePass.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) admin_reset_user_password — an admin sets someone else's password
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_reset_user_password(
  p_user_id  uuid,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email       text;
  v_target_role public.user_role;
  v_now         timestamptz := now();
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only an admin can reset a password.';
  end if;

  -- A 6-character floor matches GoTrue's own minimum and the Add User form.
  -- Enforced HERE because this path writes the hash directly and therefore
  -- never passes through the auth server's own validation.
  if p_password is null or length(p_password) < 6 then
    raise exception 'The new password must be at least 6 characters.';
  end if;

  select p.role, u.email into v_target_role, v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_email is null then
    raise exception 'That user no longer exists.';
  end if;

  -- Deliberate: an admin cannot reset another admin's password. Otherwise the
  -- weakest admin account becomes a takeover route into every stronger one,
  -- and "reset" would be an undetectable way to seize a super_admin. An admin
  -- who is locked out is a Supabase-dashboard job, on purpose.
  if v_target_role in ('admin', 'super_admin') then
    raise exception 'Admin passwords cannot be reset from the panel. Use the Supabase dashboard.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at         = v_now,
      -- 034's lesson, applied defensively: GoTrue scans these four into Go
      -- strings and dies with a 500 on NULL. Costs nothing to keep them sane.
      confirmation_token     = coalesce(confirmation_token, ''),
      recovery_token         = coalesce(recovery_token, ''),
      email_change           = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, '')
  where id = p_user_id;

  update public.profiles
  set must_change_password = true
  where id = p_user_id;

  -- Every existing session dies with the old password. Without this, someone
  -- already signed in on another device keeps full access — which defeats the
  -- point of a reset when the reason for it is a suspected compromise.
  -- refresh_tokens.session_id cascades (verified live: confdeltype 'c'); the
  -- second delete catches legacy rows that predate session_id.
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;

  return json_build_object(
    'id', p_user_id::text,
    'email', v_email,
    'must_change_password', true
  );
end;
$$;

revoke all on function public.admin_reset_user_password(uuid, text) from public;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) set_my_password — the user chooses their own, and the flag clears with it
-- ─────────────────────────────────────────────────────────────────────────────
-- The flag is cleared HERE, in the same statement that writes the password,
-- and nowhere else. A separate "clear the flag" RPC would let the forced-change
-- screen be skipped by calling it directly from the console — the flag can only
-- come down by actually setting a password.
create or replace function public.set_my_password(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_current text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to change your password.';
  end if;

  if p_password is null or length(p_password) < 6 then
    raise exception 'Your new password must be at least 6 characters.';
  end if;

  select encrypted_password into v_current from auth.users where id = v_uid;

  -- Reusing the temporary password the admin just read out over the phone
  -- leaves the account exactly as exposed as before. Refuse it by name so the
  -- message is actionable rather than a silent no-op.
  if v_current is not null and extensions.crypt(p_password, v_current) = v_current then
    raise exception 'Choose a password you have not used before.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at         = now()
  where id = v_uid;

  update public.profiles
  set must_change_password = false
  where id = v_uid;
end;
$$;

revoke all on function public.set_my_password(text) from public;
grant execute on function public.set_my_password(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) my_must_change_password — the gate reads the flag WITHOUT touching RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- The app shell asks this on every sign-in, so it must never be the thing that
-- breaks. public.profiles has a history of recursive-policy trouble (42P17 —
-- it is exactly why GatePass reads through gatepass.my_profile() instead of the
-- table), and a select that raises here would either lock everyone out of the
-- app or, worse, fail open. A SECURITY DEFINER function scoped to auth.uid()
-- sidesteps policy evaluation entirely and can only ever read one row: yours.
create or replace function public.my_must_change_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.must_change_password from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.my_must_change_password() from public;
grant execute on function public.my_must_change_password() to authenticated;

notify pgrst, 'reload schema';
