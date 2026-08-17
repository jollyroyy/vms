-- ============================================================================
-- 095 — The Users section's three reads and writes
--
-- Settings → Users (client instruction, 2026-08-17) lists every account, adds
-- one, and edits one. All three go through SECURITY DEFINER functions rather
-- than through PostgREST on `public.profiles`, for three separate reasons:
--
--   1. CREATING an account writes `auth.users`, which the browser client cannot
--      do without the service-role key — and that key must never reach a bundle.
--   2. `public.profiles` has a history of recursive-policy failures (42P17), so
--      the admin directory is one function with one predictable plan rather
--      than a policy that has to stay correct as roles are added.
--   3. The role allowlist is a RULE, and a rule enforced only by a <select> is
--      a rule any token can skip by POSTing to PostgREST directly. `admin` and
--      `super_admin` are refused server-side; so is `ceo`.
--
-- WHY `staff` IS ASSIGNABLE HERE AND IS NOT IN GATEPASS. GatePass's migration
-- 040 removed `staff` from its own allowlist because over there it means "does
-- not use this app" — it was being written as an off switch. In VMS `staff` is
-- a first-class role with its own routes (ROLE_ROUTES.staff) and it is what a
-- HOST is: `get_hosts_for_department` returns the staff and HODs attached to a
-- department. An admin who cannot create a staff account cannot onboard a host.
-- The off switch is migration 094's `user_status`, which is a different column
-- answering a different question.
--
-- DEPARTMENT APPLIES TO hod AND staff, NOT TO guard. Both of the first two can
-- be the person a visitor is there to meet; a guard belongs to a gate, not to a
-- department, and leaving a stale department_id on one would put them in a host
-- picker. VMS keeps ONE department per person in `profiles.department_id` —
-- there is no hod_departments table in this schema, that is GatePass's.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) admin_list_profiles — the directory the Users table renders
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns `role` as text, not as public.user_role: PostgREST renders an enum
-- fine, but the client's own `UserRole` union is the authority on what the app
-- understands, and a role added to the database ahead of the app should arrive
-- as a string the client can label honestly rather than as a value its type
-- claims is impossible.
--
-- `is_active` is COALESCED here, so the client never has to know that an absent
-- user_status row means active (migration 094).
drop function if exists public.admin_list_profiles(text);

create function public.admin_list_profiles(p_role text default null)
returns table (
  id             uuid,
  email          text,
  full_name      text,
  role           text,
  department_id  uuid,
  avatar_url     text,
  created_at     timestamptz,
  is_active      boolean,
  deactivated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only an admin can list users.';
  end if;

  return query
    select p.id, p.email, p.full_name, p.role::text, p.department_id, p.avatar_url,
           p.created_at, coalesce(s.is_active, true), s.deactivated_at
      from public.profiles p
      left join public.user_status s on s.user_id = p.id
     where p_role is null or p.role::text = p_role
     order by p.full_name;
end;
$$;

revoke all on function public.admin_list_profiles(text) from public;
grant execute on function public.admin_list_profiles(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) admin_create_user — a new account, with a password the admin hands over
-- ─────────────────────────────────────────────────────────────────────────────
-- The alternative was `supabase.auth.signUp` + an invitation email, which is
-- what `addHod` does today and which fails for most people: the built-in
-- Supabase mailer is capped at ~2 messages an hour PROJECT-WIDE and is shared
-- with GatePass (the same cap that took "Forgot password?" off the login card in
-- 064). An admin who can read the password aloud does not depend on it.
--
-- The account is created with `must_change_password = true`, so the temporary
-- password the admin knows is spent on first sign-in and the person chooses
-- their own — 064's forced-change screen already blocks every route until they
-- have. An admin-set password nobody is made to replace is a shared credential.
create or replace function public.admin_create_user(
  p_email         text,
  p_password      text,
  p_full_name     text,
  p_role          text,
  p_department_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_now     timestamptz := now();
  v_dept    uuid;
  v_email   text := lower(trim(p_email));
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only an admin can create users.';
  end if;

  if p_role in ('admin', 'super_admin') then
    raise exception 'An admin account cannot be created from this screen. Use the Supabase dashboard.';
  end if;

  -- `ceo` is refused too, and not as an oversight. It exists for ONE decision —
  -- granting a blacklist removal an admin has asked for — and the whole point of
  -- migration 090 is that the approver is not somebody the requester appointed.
  if p_role not in ('guard', 'hod', 'staff') then
    raise exception 'Invalid role "%". Allowed: guard, hod, staff.', p_role;
  end if;

  -- Same floor GoTrue applies. Enforced HERE because this path writes the hash
  -- directly and therefore never passes through the auth server's validation.
  if p_password is null or length(p_password) < 6 then
    raise exception 'The password must be at least 6 characters.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'An email address is required.';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'A user with email "%" already exists.', v_email;
  end if;

  -- A guard belongs to a gate, not to a department (see the header).
  v_dept := case when p_role = 'guard' then null else p_department_id end;

  v_user_id := gen_random_uuid();

  -- This insert fires public.handle_new_user(), which creates the matching
  -- public.profiles row with role 'staff' — CORRECTED below, never re-inserted,
  -- or this collides with the trigger's own row.
  --
  -- confirmation_token / recovery_token / email_change / email_change_token_new
  -- are written as '' and MUST stay in this list: they are nullable with no
  -- default, and GoTrue cannot scan a NULL into its Go string field. Omit them
  -- and the account cannot sign in at all — GatePass's migration 034 is the
  -- record of that being discovered the expensive way.
  insert into auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmation_sent_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    is_sso_user
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    v_now, v_now,
    '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
    jsonb_build_object('full_name', p_full_name),
    v_now, v_now,
    false
  );

  update public.profiles
  set full_name            = p_full_name,
      role                 = p_role::public.user_role,
      department_id        = v_dept,
      must_change_password = true
  where id = v_user_id;

  -- profiles.role is mirrored into app_metadata by sync_profile_role_to_auth
  -- (migration 010), but the row above was inserted with 'staff' by the trigger
  -- and app_metadata was seeded from it. This is the belt to that braces, and it
  -- is what `current_user_role()` will read out of the very first JWT.
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', p_role)
                          || case when v_dept is null then '{}'::jsonb
                                  else jsonb_build_object('department_id', v_dept::text) end
  where id = v_user_id;

  return json_build_object('id', v_user_id::text, 'email', v_email, 'role', p_role);
end;
$$;

revoke all on function public.admin_create_user(text, text, text, text, uuid) from public;
grant execute on function public.admin_create_user(text, text, text, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) admin_update_user — name, role, department
-- ─────────────────────────────────────────────────────────────────────────────
-- Deliberately NOT the email: changing the address someone signs in with is an
-- auth-admin operation, and rewriting only `profiles.email` would leave the
-- screen showing one address while the login accepts another.
--
-- `p_department_id` is applied whenever `p_apply_department` is true, so
-- "unassign" (null) and "leave alone" stay distinguishable — a nullable
-- parameter alone cannot say which of the two the caller meant.
create or replace function public.admin_update_user(
  p_user_id          uuid,
  p_full_name        text default null,
  p_role             text default null,
  p_department_id    uuid default null,
  p_apply_department boolean default false
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role text;
  v_new_role    text;
  v_dept        uuid;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only an admin can update users.';
  end if;

  select p.role::text into v_target_role from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'That user no longer exists.';
  end if;

  -- The same asymmetry 064's password reset draws: the weakest admin account
  -- must not be a route into a stronger one. Editing an admin is a Supabase
  -- dashboard job, on purpose.
  if v_target_role in ('admin', 'super_admin') then
    raise exception 'An admin account cannot be edited from this screen.';
  end if;

  if p_role is not null and p_role not in ('guard', 'hod', 'staff') then
    raise exception 'Invalid role "%". Allowed: guard, hod, staff.', p_role;
  end if;

  v_new_role := coalesce(p_role, v_target_role);
  -- Recomputed against the role being SAVED, not the one on file: promoting
  -- somebody to guard has to drop the department they held as staff, or they
  -- stay in that department's host picker.
  v_dept := case
              when v_new_role = 'guard' then null
              when p_apply_department then p_department_id
              else (select p.department_id from public.profiles p where p.id = p_user_id)
            end;

  update public.profiles
  set full_name     = coalesce(p_full_name, full_name),
      role          = v_new_role::public.user_role,
      department_id = v_dept,
      -- A person who no longer heads a department cannot be somebody's
      -- delegate for it either.
      delegate_id   = case when v_dept is null then null else delegate_id end
  where id = p_user_id;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', v_new_role)
                          || case when v_dept is null then jsonb_build_object('department_id', null)
                                  else jsonb_build_object('department_id', v_dept::text) end,
      updated_at = now()
  where id = p_user_id;

  return json_build_object('id', p_user_id::text, 'role', v_new_role);
end;
$$;

revoke all on function public.admin_update_user(uuid, text, text, uuid, boolean) from public;
grant execute on function public.admin_update_user(uuid, text, text, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
