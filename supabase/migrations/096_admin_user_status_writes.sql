-- ============================================================================
-- 096 — Suspending an account, and giving it back
--
-- The only two writers of `public.user_status` (migration 094). There is no
-- insert/update/delete policy on that table, so these functions are not the
-- convenient path — they are the ONLY path, the same shape the blacklist
-- removal queue uses (091/092).
--
-- The pair is deliberately asymmetric in one respect and symmetric in another:
--
--   * Both refuse an admin/super_admin target, for the reason 064 gives about
--     password resets — otherwise the weakest admin account is a route to
--     shutting down every stronger one.
--   * Only DEACTIVATION deletes sessions. Reactivation has nothing to revoke,
--     and signing somebody out at the moment you restore their access would be
--     a strange way to say welcome back.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Deactivate
-- ─────────────────────────────────────────────────────────────────────────────
-- `public.profiles` IS NOT TOUCHED. The role survives the suspension, so
-- reactivation restores exactly what was withdrawn instead of an admin guessing
-- what the account used to be — which is the whole reason 094 exists.
--
-- Every session is deleted. Without it, someone already signed in on another
-- device keeps a valid JWT: `current_user_role()` would return null for them, so
-- RLS refuses every read, and they sit in front of an app that silently shows
-- nothing. Same reasoning as 064's password reset.
create or replace function public.admin_deactivate_user(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only an admin can deactivate users.';
  end if;

  -- An admin who suspends themselves is locked out of the screen that would
  -- undo it, and nothing else in this app can.
  if p_user_id = auth.uid() then
    raise exception 'You cannot deactivate your own account.';
  end if;

  select p.role::text into v_role from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'That user no longer exists.';
  end if;

  if v_role in ('admin', 'super_admin') then
    raise exception 'An admin account cannot be deactivated from this screen.';
  end if;

  insert into public.user_status (user_id, is_active, deactivated_at, deactivated_by, updated_at)
  values (p_user_id, false, now(), auth.uid(), now())
  on conflict (user_id) do update
    set is_active      = false,
        deactivated_at = now(),
        deactivated_by = auth.uid(),
        updated_at     = now();

  -- refresh_tokens.session_id cascades from auth.sessions; the second delete
  -- catches legacy rows that predate session_id (verified live for 064).
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;

  return json_build_object('id', p_user_id::text, 'is_active', false);
end;
$$;

revoke all on function public.admin_deactivate_user(uuid) from public;
grant execute on function public.admin_deactivate_user(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Reactivate
-- ─────────────────────────────────────────────────────────────────────────────
-- No role argument and no confirmation dialog behind it: the role was never
-- destroyed, so this restores precisely what was suspended, and it is not a
-- destructive act — which is why Deactivate has a dialog and this does not.
create or replace function public.admin_reactivate_user(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only an admin can reactivate users.';
  end if;

  select p.role::text into v_role from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'That user no longer exists.';
  end if;

  if v_role in ('admin', 'super_admin') then
    raise exception 'An admin account cannot be changed from this screen.';
  end if;

  insert into public.user_status (user_id, is_active, deactivated_at, deactivated_by, updated_at)
  values (p_user_id, true, null, null, now())
  on conflict (user_id) do update
    set is_active      = true,
        deactivated_at = null,
        deactivated_by = null,
        updated_at     = now();

  return json_build_object('id', p_user_id::text, 'is_active', true);
end;
$$;

revoke all on function public.admin_reactivate_user(uuid) from public;
grant execute on function public.admin_reactivate_user(uuid) to authenticated;

notify pgrst, 'reload schema';
