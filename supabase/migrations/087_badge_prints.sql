-- 087 — the badge print log.
--
-- The admin surface gains a Badge Printing tab. `lib/printBadge.ts` already
-- exists and is called from the guard's Entry & Exit frame, so badges are
-- already being printed — nothing recorded that they had been. A reprint was
-- indistinguishable from a first print, and "how many badges did we issue
-- today" had no answer.
--
-- THIS IS A LOG, NOT A QUEUE. The admin tab lists what WAS printed; it does not
-- offer to print. That distinction is load-bearing: this project's standing
-- rule is that a badge is minted at the gate, by the guard who is looking at
-- the visitor (see the top of pages/Guard/Console.tsx and lib/passVisibility.ts),
-- and an admin who could mint one from a desk screen would be issuing an entry
-- credential to someone they cannot see. The reversal that gave admin read
-- access to visitor records did not change that — read the log, never write it.
--
-- Append-only by construction: there is no update policy and no delete policy.
-- A print either happened or it did not.

create table if not exists public.badge_prints (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid not null references public.visits(id) on delete cascade,
  -- Who pressed print. Nullable because the kiosk prints under a device
  -- session that is not a person, and recording a null is honest where naming
  -- an arbitrary profile would not be.
  printed_by uuid references public.profiles(id),
  -- 'visitor' | 'contractor' | 'reprint'. Text with a CHECK, same reasoning as
  -- entry_points.kind in 084.
  badge_type text not null default 'visitor',
  printed_at timestamptz not null default now()
);

alter table public.badge_prints drop constraint if exists badge_prints_type_valid;
alter table public.badge_prints add constraint badge_prints_type_valid
  check (badge_type in ('visitor', 'contractor', 'reprint'));

-- The tab lists today's prints newest first, and the per-visit lookup answers
-- "has this badge been printed before?" — which is what makes a reprint
-- recognisable as one.
create index if not exists badge_prints_printed_at_idx
  on public.badge_prints (printed_at desc);
create index if not exists badge_prints_visit_idx
  on public.badge_prints (visit_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.badge_prints enable row level security;

-- The guard prints, so the guard writes. `printed_by` must be the caller's own
-- id or null — a guard cannot record a print against a colleague's name.
drop policy if exists "badge_prints: gate inserts" on public.badge_prints;
create policy "badge_prints: gate inserts"
  on public.badge_prints for insert
  to authenticated
  with check (
    public.current_user_role() in ('guard', 'admin', 'super_admin')
    and (printed_by is null or printed_by = auth.uid())
  );

drop policy if exists "badge_prints: staff read" on public.badge_prints;
create policy "badge_prints: staff read"
  on public.badge_prints for select
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin', 'guard', 'hod'));
