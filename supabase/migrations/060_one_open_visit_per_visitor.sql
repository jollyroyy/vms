-- 060_one_open_visit_per_visitor.sql
--
-- A person who is already inside cannot check in again. They have to check out
-- first.
--
-- `visitors.phone` is already unique, so one visitor row IS one mobile number —
-- which makes "the same mobile number cannot check in twice" exactly the same
-- statement as "a visitor cannot hold two open visits". This partial unique
-- index is therefore the whole rule, enforced in the database rather than only
-- in the UI: the guard console, the walk-in lane and the kiosk are three
-- separate write paths on (often) three separate devices, and a check that
-- lives in a component can always be raced by the other two.
--
-- Partial on `status = 'checked_in'` on purpose. A visitor may have any number
-- of historical `checked_out` visits, and any number of future `approved` ones
-- — the constraint only bites on the one status that means "inside right now".
--
-- Verified before applying: no visitor currently holds more than one
-- checked_in visit, so this index cannot fail on existing data.
--
-- What this does NOT cover: the same person arriving on a second mobile number
-- with the same ID card. `visitors.id_last4` holds only the last four digits
-- and is nullable, so it is not a key and cannot carry a unique index without
-- generating false collisions. That case is caught in the application layer
-- (src/lib/activeVisit.ts) with a warning the guard can read and act on.
create unique index if not exists visits_one_open_per_visitor
  on public.visits (visitor_id)
  where status = 'checked_in';

comment on index public.visits_one_open_per_visitor is
  'One open visit per visitor. visitors.phone is unique, so this is what stops the same mobile number checking in twice without checking out.';
