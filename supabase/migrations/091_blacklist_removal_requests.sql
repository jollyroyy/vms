-- 091 — a blacklist removal takes two people (2026-08-17, client instruction)
--
-- "In the blacklist option have another option to put someone out of the
-- blacklist. It will ask for the justification to the admin. Once the admin
-- gives it, it will go for the approval to the CEO. Once the CEO approves then
-- only the particular person will be out of the blacklist."
--
-- APPLY 090 FIRST. This file compares against `'ceo'::public.user_role`, and
-- `ALTER TYPE … ADD VALUE` is unusable in the transaction that adds it.
--
-- THE VISITOR STAYS BLACKLISTED WHILE THE REQUEST IS OPEN (client decision).
-- Nothing here touches `visitors.is_blacklisted` until the CEO approves, so the
-- gate keeps refusing entry for the whole life of the request. The alternative
-- — lift now, revert on refusal — makes the admin's justification screen the
-- thing that actually opens the door, and a refusal then has to claw back
-- access from somebody who may already be in the building.
--
-- THE APPROVAL IS ENFORCED IN THE DATABASE, NOT IN THE SCREEN. This is the
-- part that makes the feature real rather than a workflow drawn on top of an
-- open door. The existing `prevent_guard_blacklist` trigger already stops a
-- guard or an HOD touching the flag — so the hole this closes is not theirs,
-- it is the ADMIN's: an admin could PATCH `is_blacklisted = false` straight
-- through PostgREST and never file a request at all, which makes the CEO's
-- approval a screen an admin can walk around. A two-person rule that one
-- person's API call can skip is not a rule. `enforce_blacklist_clearance`
-- (092) refuses that write from every caller except
-- `decide_blacklist_removal` (092), which is the CEO's own path — the same shape
-- migration 063 used to make `audit_logs` trigger-only rather than trusting
-- that no client would forge a row.
--
-- IT TAKES TWO TRIGGERS TO SAY IT, because they answer opposite halves and
-- both fire on the same UPDATE. `prevent_guard_blacklist` (which predates this
-- migration) says WHO MAY TOUCH THE FLAG AT ALL — admins only — and it had to
-- learn about the clearance key here, or it would refuse the CEO's own
-- approval, the CEO not being an admin. `enforce_blacklist_clearance` says
-- WHICH DIRECTION IS FREE: setting the flag stays an admin's own call, and
-- only CLEARING it needs the key. Merging them would mean one function holding
-- two unrelated rules, and the older one is depended on by tests that predate
-- this feature.
--
-- SPLIT ACROSS TWO FILES. The RPCs and the two triggers are in
-- **092_blacklist_removal_workflow.sql**, only because this project caps a
-- file at 300 lines. Apply 090, then this, then 092 — in that order.

-- ── The queue ────────────────────────────────────────────────────────────────
create table if not exists public.blacklist_removal_requests (
  id                uuid primary key default gen_random_uuid(),
  visitor_id        uuid not null references public.visitors(id) on delete cascade,
  requested_by      uuid not null references public.profiles(id),
  justification     text not null,
  -- The reason the visitor was blacklisted in the first place, COPIED AT
  -- REQUEST TIME. `visitors.blacklist_reason` is cleared on approval — leaving
  -- a reason on a visitor who is no longer flagged is a claim about them that
  -- nothing on screen would qualify — so without this snapshot the record of
  -- WHY the CEO was being asked would be destroyed by the act of granting it.
  blacklist_reason  text,
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  decided_by        uuid references public.profiles(id),
  decided_at        timestamptz,
  decision_note     text,
  created_at        timestamptz not null default now(),

  -- A pending row has no decision and a decided row has a complete one. Half a
  -- decision — an approver with no instant, or an instant with no approver — is
  -- exactly the ambiguity this table exists to remove.
  constraint blacklist_removal_decision_complete check (
    (status = 'pending'  and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  ),
  -- Mirrors `normalizeRemovalJustification` in src/lib/blacklistRemoval.ts.
  -- Long enough for a real reason, short enough that it stays one.
  constraint blacklist_removal_justification_len check (
    char_length(btrim(justification)) between 10 and 500
  ),
  constraint blacklist_removal_note_len check (
    decision_note is null or char_length(decision_note) <= 500
  )
);

-- ONE OPEN REQUEST PER VISITOR. Two admins filing the same removal on the same
-- morning gives the CEO one decision to make and two rows to make it on, and
-- approving one leaves the other pending forever against a visitor who is no
-- longer blacklisted. Enforced by the index, not by whichever screen happened
-- to check first — the same reasoning migration 086 used for one feedback row
-- per visit.
create unique index if not exists blacklist_removal_one_open_per_visitor
  on public.blacklist_removal_requests (visitor_id)
  where status = 'pending';

create index if not exists blacklist_removal_status_created_idx
  on public.blacklist_removal_requests (status, created_at desc);

alter table public.blacklist_removal_requests enable row level security;

-- ── Who may see the queue ────────────────────────────────────────────────────
-- The admin who files, and the CEO who decides. Nobody at the gate: a guard
-- refusing entry needs to know the visitor is blacklisted, which
-- `visitors.is_blacklisted` already tells them, and the internal argument about
-- whether to lift it is not theirs to read.
drop policy if exists "blacklist removals: admin and ceo can read" on public.blacklist_removal_requests;
create policy "blacklist removals: admin and ceo can read"
  on public.blacklist_removal_requests for select
  using (public.current_user_role() = any (array['admin','super_admin','ceo']::public.user_role[]));

-- NO INSERT, UPDATE OR DELETE POLICY EXISTS, and that is the design. Both
-- writes go through the SECURITY DEFINER functions in 092, which is what lets
-- each one enforce its own half of the two-person rule — that the requester is
-- an admin and the visitor really is blacklisted, and that the decider is the
-- CEO and the clearance happens in the same statement as the decision. A row
-- this table can be talked into by a direct PATCH is a row the rule does not
-- cover.

-- ── The CEO needs to be able to READ the two things the queue names ──────────
-- A queue of visitor ids and profile ids the reader cannot resolve is a screen
-- that asks somebody to approve a name they cannot see. Both policies are
-- WIDENED BY ONE ROLE and otherwise left exactly as they were.
drop policy if exists "visitors: read scoped by role" on public.visitors;
create policy "visitors: read scoped by role"
  on public.visitors for select
  using (
    public.current_user_role() = any (array['guard','admin','super_admin','ceo']::public.user_role[])
    or exists (
      select 1 from public.visits
      where visits.visitor_id = visitors.id
        and visits.department_id = ((auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid)
    )
  );

drop policy if exists "profiles: read scoped by role" on public.profiles;
create policy "profiles: read scoped by role"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.current_user_role() = any (array['guard','admin','super_admin','ceo']::public.user_role[])
    or department_id = ((auth.jwt() -> 'app_metadata' ->> 'department_id')::uuid)
  );
