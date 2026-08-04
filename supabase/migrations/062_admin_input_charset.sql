-- 062: character + length constraints on admin-entered identity text.
--
-- WHY THE DATABASE AND NOT JUST THE FORM
-- src/lib/inputRules.ts holds the same rules, but client validation is a
-- usability guard: anyone holding an admin token can POST straight to PostgREST
-- and skip it entirely. These CHECK constraints are the actual boundary.
--
-- WHAT THIS IS NOT
-- This is not an SQL-injection fix. Nothing in the app concatenates SQL —
-- supabase-js sends parameterised values through PostgREST — so injection is
-- structurally unavailable, with or without these constraints. What they buy is
-- data hygiene: bounded length, no invisible control characters, no emoji or
-- homoglyph department names, no leading/trailing whitespace.
--
-- VERIFIED AGAINST LIVE (project oxzzeonftrmohdrancex) BEFORE WRITING.
-- Three existing rows would have failed a naive version of this migration, and
-- each one changed the rule rather than the other way round:
--   1. departments.code = 'R&D'          → '&' is allowed in codes.
--   2. departments.name = 'Sales '       → trailing space; trimmed below.
--   3. profiles.full_name = 'soham patra '→ trailing space; trimmed below.
-- A fourth, profiles.full_name = 'Bugfix Test 2', contains a digit and still
-- violates the person-name rule. It is left in place: the constraint is added
-- NOT VALID so historic rows are not rewritten behind the admin's back. New and
-- updated rows are checked from now on.

begin;

-- Cosmetic normalisation only — btrim changes no meaning, and every write path
-- in the app has always trimmed. Without it the "no surrounding whitespace"
-- constraints below cannot be created.
update departments set name = btrim(name) where name <> btrim(name);
update departments set code = btrim(code) where code <> btrim(code);
update profiles    set full_name = btrim(full_name) where full_name <> btrim(full_name);

-- ---------------------------------------------------------------- departments
alter table departments
  add constraint departments_name_charset
    check (name ~ '^[A-Za-z0-9 &./''-]+$'),
  add constraint departments_name_length
    check (char_length(name) between 2 and 60),
  add constraint departments_name_trimmed
    check (name = btrim(name));

alter table departments
  add constraint departments_code_charset
    check (code ~ '^[A-Z0-9&-]+$'),
  add constraint departments_code_length
    check (char_length(code) between 1 and 10);

-- ------------------------------------------------------------------- profiles
-- NULL passes a CHECK, which is correct here: handle_new_user (migration 010)
-- inserts the profile row inside the signUp transaction and full_name may not be
-- known yet. The constraint bites when a name is actually supplied.
alter table profiles
  add constraint profiles_full_name_charset
    check (full_name is null or full_name ~ '^[A-Za-z .''-]+$') not valid,
  add constraint profiles_full_name_length
    check (full_name is null or char_length(full_name) between 2 and 80) not valid,
  add constraint profiles_full_name_trimmed
    check (full_name is null or full_name = btrim(full_name)) not valid;

commit;

-- To enforce the profile rules over history as well, clean the offending rows
-- and then:
--   alter table profiles validate constraint profiles_full_name_charset;
--   alter table profiles validate constraint profiles_full_name_length;
--   alter table profiles validate constraint profiles_full_name_trimmed;
