-- 099 — what `senior_manager` may DO. Apply 098 first (see its header: the enum
-- value cannot be added and used in one transaction).
--
-- ONE EDIT, NOT TWELVE. Twelve policies in this schema name 'hod', and several
-- SECURITY DEFINER functions test it as well — but not one of them reads
-- `profiles.role` directly. They all go through `public.current_user_role()`.
-- So the whole "a senior manager is an HOD" rule is installed by teaching that
-- ONE function to answer `hod` for a senior manager, and every existing policy
-- follows automatically. Rewriting twelve policies would have produced twelve
-- chances to get one of them subtly wrong, and would have left the thirteenth —
-- whichever policy is written next year against 'hod' — silently excluding this
-- role again.
--
-- WHAT THIS MAPPING DOES NOT DO: it does not hide who acted. `profiles.role`
-- still stores `senior_manager`, the JWT still carries it (that is what the app
-- reads to pick a sidebar and a landing page), the user directory still prints
-- it, and every audit row is stamped with `auth.uid()` rather than a role — so
-- a senior manager's approval is attributable to that person, exactly as an
-- HOD's is. The mapping is about PERMISSION, and permission is the one thing
-- the two roles are meant to share.
--
-- REBASED ON THE LIVE BODY, per this project's standing rule (memory SB-15).
-- The version below is `pg_get_functiondef` as read from the live database on
-- 2026-08-18 — migration 094's suspension gate included, since that is what is
-- actually deployed — with the single `case` mapping added and nothing removed.
-- Diff it before and after; if the suspension branch is missing from what you
-- are about to apply, you are looking at a stale copy.
--
-- `CREATE OR REPLACE`, never DROP: policies all over this database depend on
-- this function, and a DROP would resets its ACL as well as taking them with it.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path to ''
as $function$
  select case
           when not public.is_user_active(auth.uid()) then null
           -- A suspended caller still reads NULL (094) — checked FIRST, so no
           -- amount of role mapping can hand a withdrawn account a permission.
           when (auth.jwt() -> 'app_metadata' ->> 'role') = 'senior_manager'
             then 'hod'::public.user_role
           else (auth.jwt() -> 'app_metadata' ->> 'role')::public.user_role
         end;
$function$;

-- The two admin RPCs that decide which roles Settings → Users may hand out
-- (migration 095). The allowlist is widened by exactly one member. `admin`,
-- `super_admin` and `ceo` stay refused here and not merely in the <select>,
-- because a rule enforced only by a dropdown is one any token skips by POSTing
-- to PostgREST — and the weakest admin account must not be a route into a
-- stronger one (the 064 rule).
--
-- Only the two `p_role` guards change; both function bodies are otherwise the
-- live text verbatim. Note `v_dept`: it keys on `= 'guard'`, so a senior
-- manager KEEPS a department without either function being taught the new role
-- — which is correct, since `get_hosts_for_department` returns everybody
-- attached to a department and a senior manager must appear in the host picker.
create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text, p_role text,
  p_department_id uuid default null::uuid
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
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

  if p_role not in ('guard', 'hod', 'senior_manager', 'staff') then
    raise exception 'Invalid role "%". Allowed: guard, hod, senior_manager, staff.', p_role;
  end if;

  if p_password is null or length(p_password) < 6 then
    raise exception 'The password must be at least 6 characters.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'An email address is required.';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'A user with email "%" already exists.', v_email;
  end if;

  v_dept := case when p_role = 'guard' then null else p_department_id end;

  v_user_id := gen_random_uuid();

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

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', p_role)
                          || case when v_dept is null then '{}'::jsonb
                                  else jsonb_build_object('department_id', v_dept::text) end
  where id = v_user_id;

  return json_build_object('id', v_user_id::text, 'email', v_email, 'role', p_role);
end;
$function$;

create or replace function public.admin_update_user(
  p_user_id uuid, p_full_name text default null::text, p_role text default null::text,
  p_department_id uuid default null::uuid, p_apply_department boolean default false
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
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

  if v_target_role in ('admin', 'super_admin') then
    raise exception 'An admin account cannot be edited from this screen.';
  end if;

  if p_role is not null and p_role not in ('guard', 'hod', 'senior_manager', 'staff') then
    raise exception 'Invalid role "%". Allowed: guard, hod, senior_manager, staff.', p_role;
  end if;

  v_new_role := coalesce(p_role, v_target_role);
  v_dept := case
              when v_new_role = 'guard' then null
              when p_apply_department then p_department_id
              else (select p.department_id from public.profiles p where p.id = p_user_id)
            end;

  update public.profiles
  set full_name     = coalesce(p_full_name, full_name),
      role          = v_new_role::public.user_role,
      department_id = v_dept,
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
$function$;

-- Re-granted explicitly. `CREATE OR REPLACE` keeps the existing ACL, so these
-- are belt and braces — but this project has been bitten by a DROP resetting a
-- grant often enough (059, 073, 077, 080, 092 all re-grant) that stating the
-- intended end state beats relying on what was there before.
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.admin_create_user(text, text, text, text, uuid) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, uuid, boolean) to authenticated;
