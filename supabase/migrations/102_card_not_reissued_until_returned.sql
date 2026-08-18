-- ============================================================================
-- 102 — ONE PHYSICAL CARD, ONE HOLDER
--
-- Client instruction, 2026-08-18: "the same card number cannot be assigned
-- twice, until and unless it gets returned — and that only for today. Suppose
-- C-124: if it has not been returned it cannot be assigned again."
--
-- Migration 076 minted `visitor_card_number` at check-in and demanded it back
-- at check-out, and 097 indexed it so a guard could look a visitor up by the
-- card in their hand. Nothing ever asked the opposite question: is this number
-- ALREADY out? Two visitors could be issued C-124 an hour apart, and the exit
-- desk then held two open visits demanding one card back. The guard collects
-- one card and ticks one box; the other tick is an assertion about an object
-- that is not there — which is the same class of defect as an unconditional
-- "Identity verified", and this project's oldest rule forbids it.
--
-- TWO INDEXES, BECAUSE THERE ARE TWO WAYS A CARD IS STILL OUT:
--
--   1. Its holder is INSIDE. Any day — a contractor who arrived at 21:00 last
--      night is still carrying it this morning — so this one carries no date
--      bound at all. It is the fire-marshal fact: at most one live visit may
--      claim a given card.
--
--   2. Its holder LEFT WITHOUT HANDING IT BACK, today. Bounded to the IST day
--      it was issued on, and that bound is the client's "only for today". A
--      card is reissued daily; without the bound, one lost card would wedge its
--      number out of the stack permanently, and there is no screen in this app
--      that could release it — the app has no card-inventory surface, only
--      these two columns on a visit. Tomorrow the number is free, and the card
--      that never came back is still on the record and still counted by the
--      guard dashboard's Cards Not Returned tile.
--
-- UNIQUE INDEXES, NOT A TRIGGER. Three devices write check-ins; a pre-check in
-- the app can only narrow the race, never close it (the same reasoning behind
-- 060's one-open-visit-per-visitor index). src/lib/cardAssignment.ts is the
-- client half — it names the holder so a guard reads a sentence instead of a
-- constraint, and it matches BOTH names below so an unrelated 23505 is never
-- mislabelled. Keep the two in step.
--
-- BEFORE APPLYING: if either CREATE fails with "could not create unique index",
-- the live data already contains a double-issued card. Find them with the two
-- queries in the DO block below — it runs first and raises a NOTICE naming
-- every offending number, so the failure is legible rather than a row id.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Say what is already broken, before trying to forbid it
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  found_any boolean := false;
begin
  for r in
    select upper(visitor_card_number) as card, count(*) as n
      from public.visits
     where visitor_card_number is not null
       and status = 'checked_in'
     group by 1 having count(*) > 1
  loop
    found_any := true;
    raise notice 'Card % is claimed by % live visits — check one of them out before applying 102.', r.card, r.n;
  end loop;

  for r in
    select upper(visitor_card_number) as card,
           date(timezone('Asia/Kolkata', checked_in_at)) as day,
           count(*) as n
      from public.visits
     where visitor_card_number is not null
       and visitor_card_returned_at is null
       and checked_in_at is not null
     group by 1, 2 having count(*) > 1
  loop
    found_any := true;
    raise notice 'Card % was issued % times on % without being returned — stamp visitor_card_returned_at on the closed ones before applying 102.', r.card, r.n, r.day;
  end loop;

  if not found_any then
    raise notice '102: no double-issued cards found. Safe to index.';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) At most one LIVE holder per card, on any day
-- ─────────────────────────────────────────────────────────────────────────────
-- `upper(...)` because the number is read off a printed card and typed by hand:
-- c-124 and C-124 are one card, and a rule that a shift key defeats is not a
-- rule. Same expression 097's lookup index uses, so the guard's card search and
-- this constraint agree about what "the same card" means.
create unique index if not exists visits_card_live_holder_uidx
  on public.visits (upper(visitor_card_number))
  where status = 'checked_in' and visitor_card_number is not null;

-- 097's index was the non-unique version of exactly this expression and
-- predicate, created for the Find & Scan card lookup. The unique one above
-- serves that lookup identically, so keeping both would mean maintaining two
-- indexes over one set of rows.
drop index if exists public.visits_card_number_inside_idx;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) No reissue of an unreturned card within its own IST day
-- ─────────────────────────────────────────────────────────────────────────────
-- The day key is `date(timezone('Asia/Kolkata', checked_in_at))` rather than a
-- call to `vms_day_start_ist()`: an index expression must be IMMUTABLE, and
-- `timezone(text, timestamptz)` is, while anything reading the session TimeZone
-- (a bare timestamptz→date cast) is only STABLE and is rejected here.
--
-- NOTE this is the CALENDAR IST day, not the 22:00 close `vms_day_end_ist`
-- defines (075). That is deliberate and it is the safer direction: a card
-- issued at 23:00 belongs, for the purpose of "has it come back", to the night
-- it was handed over, and the sweep that closes the day's visits runs against
-- its own predicate regardless.
create unique index if not exists visits_card_unreturned_today_uidx
  on public.visits (
    upper(visitor_card_number),
    (date(timezone('Asia/Kolkata', checked_in_at)))
  )
  where visitor_card_number is not null
    and visitor_card_returned_at is null
    and checked_in_at is not null;

comment on column public.visits.visitor_card_number is
  'The number on the physical card handed over at check-in (076). Unique among '
  'live visits, and unique among unreturned issues within one IST day (102) — a '
  'card cannot be assigned again until it is returned. Compared case-'
  'insensitively: it is typed by hand off a printed card.';

notify pgrst, 'reload schema';
