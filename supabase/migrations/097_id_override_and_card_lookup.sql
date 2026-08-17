-- ============================================================================
-- 097 — Two facts the gate needed a column for
--
-- 1. THAT A GUARD OVERRODE A NAME MISMATCH. Since 2026-08-17 an ID scan is
--    mandatory on every check-in, and `namesMatch` refuses a scan naming
--    somebody else — which is right until the visitor is standing there with a
--    married name, an initial the OCR ate, or a Devanagari card the parser read
--    as three words in a different order. The client's instruction is leniency:
--    the guard may override and admit them, with NO reason typed, because a
--    mandatory text box at a gate is a queue.
--
--    But an override that leaves no trace makes "Identity verified" a claim the
--    system cannot stand behind — this project's oldest rule. So the FACT is
--    recorded and the EXPLANATION is not: one boolean, written by the same
--    update that checks the visitor in, costing the guard nothing.
--
-- 2. WHICH VISIT HOLDS A GIVEN PHYSICAL CARD. `visitor_card_number` has existed
--    since 076, but nothing ever looked a visit up BY it. The guard's find-and-
--    scan surface now does: a card is the one identifier a visitor is carrying
--    in their hand, and asking them to remember a ref number instead is asking
--    the wrong question.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) The override flag
-- ─────────────────────────────────────────────────────────────────────────────
-- NOT NULL DEFAULT false, so every historical row reads "no override" — which
-- is true of all of them, because until this migration there was no way to
-- perform one. A nullable column would make "not overridden" and "we were not
-- recording this yet" the same value at the one moment the answer matters.
alter table public.visits
  add column if not exists id_match_overridden boolean not null default false;

comment on column public.visits.id_match_overridden is
  'True when the guard admitted this visitor despite the scanned ID naming '
  'somebody other than the approved visitor (or, on a walk-in registration, '
  'somebody other than the name typed at the gate). No reason is collected by '
  'design — see migration 097. Never render "Identity verified" for a row where '
  'this is true.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) The card lookup
-- ─────────────────────────────────────────────────────────────────────────────
-- PARTIAL, on `checked_in` only. The guard's card search answers exactly one
-- question — "who is holding C-104 right now?" — and a card is reissued to a
-- different visitor the day after it comes back, so the historical rows are not
-- what a lookup wants and indexing them would only make the index bigger than
-- the answer.
--
-- Indexed on `upper(...)` because the number is read off a printed card and
-- typed by hand: c-104 and C-104 are the same card, and a lookup that says "no
-- match" over a shift key is worse than no lookup.
create index if not exists visits_card_number_inside_idx
  on public.visits (upper(visitor_card_number))
  where status = 'checked_in' and visitor_card_number is not null;

notify pgrst, 'reload schema';
