-- 088 — how long a check-in took.
--
-- The admin dashboard's third tile reads "Avg Check-in Time — 38s", and the
-- Reports screen trends it across the week. Nothing measured it. The obvious
-- substitute — `checked_in_at` minus `scheduled_for` — measures how PUNCTUAL
-- the visitor was, which is a fact about them, not about the desk, and it is
-- undefined for every walk-in. The other obvious substitute, the gap between
-- the visit row being created and being checked in, is days long for a
-- pre-approval booked in advance.
--
-- So it is measured where it actually happens: the client starts a clock when
-- the check-in flow opens for a visitor and stores the elapsed seconds at the
-- moment of the write. A SINGLE INTEGER rather than a `checkin_started_at`
-- timestamp, because a start timestamp is only meaningful paired with the end
-- one and invites the reader to subtract two columns that may straddle a guard
-- walking away mid-flow. The number stored is the number reported.
--
-- NULLABLE, and null on every existing row. A visit checked in before this
-- column existed took some length of time nobody measured; the tile averages
-- the rows that carry a duration and says how many that was.

alter table public.visits add column if not exists checkin_duration_seconds integer;

-- Bounded on both ends. Zero is not a check-in, and anything past an hour is a
-- guard who opened the flow and came back after lunch — including it would
-- drag a 38-second mean into the minutes and make the tile useless in exactly
-- the case it is meant to catch. The client clamps to the same range and
-- writes null rather than a value outside it, so a long-abandoned flow is
-- recorded as unmeasured instead of as slow.
alter table public.visits drop constraint if exists visits_checkin_duration_range;
alter table public.visits add constraint visits_checkin_duration_range
  check (checkin_duration_seconds is null
         or (checkin_duration_seconds > 0 and checkin_duration_seconds <= 3600));

-- A duration only means anything on a visit that was actually checked in.
alter table public.visits drop constraint if exists visits_duration_needs_checkin;
alter table public.visits add constraint visits_duration_needs_checkin
  check (checkin_duration_seconds is null or checked_in_at is not null);
