-- 092 — the two halves of a blacklist removal, and the gate under them
--     (2026-08-17, applied + verified live)
--
-- The second half of migration 091, split out only because this project caps a
-- file at 300 lines. Read 091 first: it holds the table, the queue's read
-- policy and the full reasoning for why a removal takes two people. APPLY 091
-- BEFORE THIS FILE — every function here writes to a table that file creates.
--
-- 091 deliberately gave `blacklist_removal_requests` NO insert, update or
-- delete policy. These two SECURITY DEFINER functions are why: each enforces
-- one half of the two-person rule, and a row that could be reached by a direct
-- PATCH is a row neither half covers.

-- ── The admin's half: file a request ─────────────────────────────────────────
create or replace function public.request_blacklist_removal(
  p_visitor_id uuid,
  p_justification text
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_flagged boolean;
  v_reason text;
begin
  if public.current_user_role() is distinct from 'admin'::public.user_role
     and public.current_user_role() is distinct from 'super_admin'::public.user_role then
    raise exception 'Only an admin can request a blacklist removal';
  end if;

  if char_length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'A justification of at least 10 characters is required';
  end if;

  select is_blacklisted, blacklist_reason into v_flagged, v_reason
  from public.visitors where id = p_visitor_id;

  if v_flagged is null then
    raise exception 'No such visitor';
  end if;
  -- Asking to remove somebody who is not on the list would leave a request the
  -- CEO can approve to no effect, and a record implying they were flagged.
  if not v_flagged then
    raise exception 'That visitor is not blacklisted';
  end if;

  insert into public.blacklist_removal_requests
    (visitor_id, requested_by, justification, blacklist_reason)
  values
    (p_visitor_id, auth.uid(), btrim(p_justification), v_reason)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── The CEO's half: decide it, and clear the flag in the same statement ──────
create or replace function public.decide_blacklist_removal(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_visitor uuid;
  v_status text;
begin
  if public.current_user_role() is distinct from 'ceo'::public.user_role then
    raise exception 'Only the CEO can decide a blacklist removal';
  end if;

  select visitor_id, status into v_visitor, v_status
  from public.blacklist_removal_requests where id = p_request_id for update;

  if v_visitor is null then
    raise exception 'No such removal request';
  end if;
  -- Deciding a decided request would overwrite the first decision and its
  -- instant, which is the one thing on this row somebody may later be asked
  -- to account for.
  if v_status <> 'pending' then
    raise exception 'That request has already been decided';
  end if;

  update public.blacklist_removal_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_request_id;

  if p_approve then
    -- The key that gets this one clearance past the two triggers on
    -- `visitors`. `true` = transaction-local, so it can never outlive the
    -- request — the same discipline `sweep_no_shows_daily()` uses for its
    -- service-role claim.
    --
    -- IT IS CLEARED AGAIN ON THE NEXT LINE, and that line is not tidiness.
    -- Transaction-local is not statement-local: left set, every later UPDATE
    -- in the same transaction would also be waved through, so an admin who
    -- could get a second statement into this transaction would be clearing
    -- flags the CEO never saw. Nothing can do that through PostgREST today —
    -- it gives each request its own transaction, and an admin cannot reach
    -- this line at all, the role check above having already refused them. That
    -- is exactly why it is worth closing: the gate would be resting on a
    -- property of the HTTP layer rather than on anything this function says.
    -- Verified live by probe 8b, which caught the wider version.
    perform set_config('vms.blacklist_clearance', p_request_id::text, true);
    update public.visitors
       set is_blacklisted = false, blacklist_reason = null
     where id = v_visitor;
    perform set_config('vms.blacklist_clearance', '', true);
  end if;
end;
$$;

-- ── The gate on the flag itself ──────────────────────────────────────────────
-- Clearing a blacklist is the ONE write on `visitors` that needs two people, so
-- it is the one write the table refuses to take on anybody's word. Setting the
-- flag is untouched: an admin blacklists a visitor on their own authority, and
-- adding an approval step in front of a protective action would mean a visitor
-- who should be refused stays admissible until somebody answers an email.
create or replace function public.enforce_blacklist_clearance()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if coalesce(old.is_blacklisted, false) and not coalesce(new.is_blacklisted, false) then
    if public.is_service_role() then
      return new;
    end if;
    if coalesce(current_setting('vms.blacklist_clearance', true), '') = '' then
      raise exception
        'A blacklist can only be lifted by CEO approval of a removal request'
        using hint = 'Call request_blacklist_removal(), then have the CEO call decide_blacklist_removal().';
    end if;
  end if;
  return new;
end;
$$;

-- `prevent_guard_blacklist` restricts EVERY blacklist write to an admin, so
-- without this one line the CEO's approval is refused by a trigger written
-- before the CEO existed — the clearance would be unreachable from the only
-- path allowed to perform it. The body is otherwise byte-for-byte the live one
-- (verified by diffing `pg_get_functiondef` before and after): one early
-- return added, nothing removed. That is the `memory.md` SB-15 discipline —
-- a CREATE OR REPLACE of a function recreated by an earlier migration must be
-- rebased on the LIVE body, never on the text of the file that first wrote it.
create or replace function public.prevent_guard_blacklist()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if public.is_service_role() then return new; end if;
  -- A CEO-approved clearance carries a transaction-local key set by
  -- `decide_blacklist_removal`, and that is the one non-admin route through
  -- here. It is safe to honour blindly: the key can only be set inside that
  -- SECURITY DEFINER function, which has already established that the caller
  -- is the CEO and that the request was pending.
  if coalesce(current_setting('vms.blacklist_clearance', true), '') <> '' then
    return new;
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    if new.is_blacklisted   is distinct from old.is_blacklisted
    or new.blacklist_reason is distinct from old.blacklist_reason then
      raise exception 'Only admin can modify blacklist status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_blacklist_clearance on public.visitors;
create trigger trg_enforce_blacklist_clearance
  before update on public.visitors
  for each row execute function public.enforce_blacklist_clearance();

-- ── ACLs (the 073 lesson: CREATE FUNCTION grants EXECUTE to PUBLIC) ──────────
revoke all on function public.request_blacklist_removal(uuid, text) from public;
revoke all on function public.decide_blacklist_removal(uuid, boolean, text) from public;
revoke all on function public.enforce_blacklist_clearance() from public;
grant execute on function public.request_blacklist_removal(uuid, text) to authenticated;
grant execute on function public.decide_blacklist_removal(uuid, boolean, text) to authenticated;
-- The role check lives INSIDE each function, deliberately. Granting to
-- `authenticated` and refusing there gives a guard who calls it a spoken
-- reason; granting per-role at the ACL gives them "permission denied for
-- function", which is indistinguishable from the feature being broken.

grant select on public.blacklist_removal_requests to authenticated;
