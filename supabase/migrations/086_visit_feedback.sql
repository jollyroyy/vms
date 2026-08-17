-- 086 — guest satisfaction.
--
-- The admin dashboard's sixth tile reads "4.6 ★ / Based on 62 reviews". There
-- was no rating anywhere in this system, so that tile could only ever have been
-- a hardcoded number — the same class of claim as the "Gate Status: Operational"
-- chip and the unconditional "Identity verified" line this project has already
-- removed. A satisfaction score nobody submitted is worse than no score.
--
-- ONE ROW PER VISIT, enforced by a unique constraint rather than by whichever
-- screen happens to collect it. The kiosk is the natural place to ask (a
-- visitor is standing at it on the way out), but the guard's check-out and a
-- future emailed link are both plausible second collectors, and three writers
-- with no constraint is how one visit ends up rated three times and the mean
-- drifts toward whoever pressed hardest.
--
-- The rating is 1-5 INTEGER. A decimal scale invites a UI that cannot be
-- operated with a thumb at a kiosk, and the tile's "4.6" is the MEAN, computed
-- at read time — never stored, so it cannot go stale against the rows.

create table if not exists public.visit_feedback (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid not null references public.visits(id) on delete cascade,
  rating     integer not null,
  -- The visitor's own words. Prose typed on a touchscreen, so length-capped
  -- rather than character-allowlisted, the same call migration 068 made for
  -- `visits.remarks`.
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.visit_feedback drop constraint if exists visit_feedback_rating_range;
alter table public.visit_feedback add constraint visit_feedback_rating_range
  check (rating between 1 and 5);

alter table public.visit_feedback drop constraint if exists visit_feedback_comment_len;
alter table public.visit_feedback add constraint visit_feedback_comment_len
  check (comment is null or char_length(comment) <= 500);

-- The whole point: a visit is rated once.
create unique index if not exists visit_feedback_visit_key
  on public.visit_feedback (visit_id);

-- The dashboard tile averages today's rows; the reports window averages a range.
create index if not exists visit_feedback_created_idx
  on public.visit_feedback (created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.visit_feedback enable row level security;

-- Anyone signed in may record a rating — the kiosk and the guard's check-out
-- both run under an authenticated session and both are collecting it ON THE
-- VISITOR'S BEHALF, since the visitor has no account here. The unique index is
-- what makes that safe: a second submission for the same visit is refused by
-- the database, so the widest write policy in this schema still cannot be used
-- to stuff a score.
drop policy if exists "visit_feedback: authenticated inserts" on public.visit_feedback;
create policy "visit_feedback: authenticated inserts"
  on public.visit_feedback for insert
  to authenticated
  with check (rating between 1 and 5);

-- Read is ADMIN AND HOD only. A satisfaction score is a judgement of the people
-- who hosted the visit; it belongs on the report and the department board, not
-- on a gate screen where the visitor who wrote it may be standing.
drop policy if exists "visit_feedback: admin and hod read" on public.visit_feedback;
create policy "visit_feedback: admin and hod read"
  on public.visit_feedback for select
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin', 'hod'));

-- No update policy and no delete policy, deliberately. A rating that can be
-- edited by the party being rated is not a rating. Corrections, if they are
-- ever needed, are a service-role job with a reason recorded.
