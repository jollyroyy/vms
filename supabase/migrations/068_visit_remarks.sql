-- 068 — `visits.remarks`: what the guard knows that the form's fields cannot say.
--
-- WHY NOT REUSE carrying_remarks. That column has one meaning — a description of
-- the material a visitor is carrying — and it is deliberately paired with the
-- `carrying_material` tick box: unticking the box discards the text, so no
-- orphaned description survives on a visit flagged as carrying nothing (see 058
-- and the CheckInPhotoStep note in CLAUDE.md). Putting the guard's general note
-- in there would resurrect exactly the ambiguity 058 removed — "is this text a
-- description of goods, or something else entirely?" — and Reports prints it in
-- a column headed `Carrying Remarks`, which would then be a lie.
--
-- WHY IT EARNS A COLUMN. A walk-in is the one visit an HOD approves BLIND. For a
-- pre-approval they chose the visitor themselves; for a walk-in they get a name,
-- a vendor and a purpose picked from a seven-item enum, and are asked to decide.
-- "Says he has an appointment with you at 3", "delivery driver, van at gate 2",
-- "third visit this week" is exactly the context that makes that decision
-- possible, and today it has nowhere to live.
--
-- Nullable, no default: a guard in a hurry must never be blocked by a free-text
-- field, and an empty note must be indistinguishable from an unanswered one.

alter table public.visits
  add column if not exists remarks text;

comment on column public.visits.remarks is
  'Free-text context captured when a visit is raised (walk-in registration). NOT carrying_remarks, which describes material only.';

-- Length only. src/lib/inputRules.ts allowlists CHARACTERS for admin-entered
-- names and codes because those are short, structured identifiers; this is prose
-- typed at a gate under time pressure, and an allowlist would reject the
-- apostrophes, slashes and digits that make it useful. A cap is what actually
-- protects the table — it bounds the row, and nothing here is ever concatenated
-- into SQL or rendered as HTML (React escapes by default), so the character set
-- carries no risk to defend against. Guessing at "bad" substrings would be the
-- blocklist game CLAUDE.md already rejects.
alter table public.visits
  drop constraint if exists visits_remarks_length;

alter table public.visits
  add constraint visits_remarks_length
  check (remarks is null or char_length(remarks) <= 500);
