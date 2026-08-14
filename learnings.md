# Project Learnings

Critical lessons learned during VMS development sessions.

---

## Database Schema Validation

- **Always verify column existence in Supabase before adding to TypeScript types**
- Never assume columns exist - check the actual DB schema first
- Columns removed in this session: `approved_at`, `approved_by`, `consent_privacy`, `consent_site_rules`, `nda_signature`, `privacy_signature`, `site_rules_signature`

---

## Insert Call Validation

- Every `.from('table').insert({...})` call must only use columns that exist in the DB
- Test insert calls against the actual schema, not TypeScript types
- TypeScript types are convenience wrappers, not DB schema guarantees

```typescript
// BAD - may include columns that don't exist in DB
const { error } = await supabase.from('volunteers').insert({
  full_name: name,
  email: email,
  approved_at: new Date(), // column doesn't exist
});

// GOOD - only use verified columns
const { error } = await supabase.from('volunteers').insert({
  full_name: name,
  email: email,
});
```

---

## Component Lifecycle

- Camera streams MUST be stopped on component unmount
- Use cleanup functions in `useEffect` to stop media tracks
- Navigate away from pages with active media streams carefully

```typescript
useEffect(() => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });

  return () => {
    stream.getTracks().forEach((track) => track.stop());
  };
}, []);
```

---

## Theme System

- Login page uses **fixed light theme** (no dark mode toggle)
- Other pages use the `ThemeProvider` for dark/light toggle
- Never mix theme systems

---

## Testing Patterns

- Always run `npm run build` after schema changes
- Always run full test suite before committing
- Pre-existing test failures (e.g., `rls.test.ts`) are environment issues, not regressions

---

## File Organization

- Keep learnings in `LEARNINGS.md` at project root
- Reference `goal.md` for feature requirements
- Use TDD loop engineering for new features

---

## Booleans Inferred From Text Fields

- A boolean inferred from whether a text field is non-empty cannot distinguish "no" from
  "not recorded". `carrying_material` used to be "did the guard type anything in remarks",
  which made an empty box mean both "not carrying anything" and "was carrying something,
  guard got interrupted before writing it down" — the same value, two different facts.
- Fix pattern: make the boolean its own explicit control (a checkbox), and let the text
  field exist only to elaborate on a `true`. Historical rows written before the field
  existed still need a third on-screen state ("Not recorded"), not a blank cell that reads
  as "no".

## UI-Only Uniqueness Checks Are Unenforceable

- A uniqueness check that lives only in a component can always be raced by another write
  path touching the same table. The VMS has three: guard console, kiosk, and a second
  guard device. A duplicate-check-in guard in `VisitorForm` alone is a suggestion, not a
  rule.
- The real fix is a DB constraint (a partial unique index scoped to the one status that
  means "active"), with the UI-side check kept only because it can *name* the conflict
  ("Priya Nair is already inside") where a raw `23505` cannot.
- Corollary: not every uniqueness fact belongs in the database. If the key is inherently
  weak (last-4-digits-only ID proof, nullable, not guaranteed unique across people), a
  unique index would generate false collisions — that case has to stay a warning in the
  application layer instead of a hard block.

## A Count and the List It Opens Must Share One Predicate

- The guard dashboard's KPI tiles and their in-place drill-down lists disagreed on
  screen — a tile could read 1 and expand into 5 cards — because the count came from
  one query (`useGateStats`) and the drill-down list was filtered with a separately
  maintained inline predicate. The two drifted apart as each was edited independently.
- Fix pattern: one predicate module (`src/lib/guardTiles.ts`'s `TILE_FILTER` +
  `tileVisits()`) that both the count (`list.length`) and the rendered list are
  derived from. If a tile shows "N" next to a control that reveals N items, that N
  must literally be `revealedList.length`, not a second, independently computed number.

## Two Hooks Answering the Same Question Need the Same Window

- A "today" query window that only checked `created_at` silently dropped a visitor
  who arrived at 21:00 the day before and never checked out: the summary count
  (unbounded for open statuses) still counted them as inside, but the list view
  (day-bounded) no longer showed them at all — present in the number, absent from
  the list behind it.
- Fix pattern: every hook that lists the rows behind a KPI count must OR in the same
  open-status condition, unbounded by date, that the count's own query uses. When
  auditing a "today" query, ask whether a sibling count considers an older open row
  in scope — if it does, the list query must match it exactly.

## Dead Code Plus Stale Docs Is Worse Than Either Alone

- A previous implementation of an entire guard-dashboard screen (five components, a
  lib file, and their tests) survived a full rebuild while imported by nothing —
  and the project's own CLAUDE.md kept describing it as the live implementation.
  Neither problem alone is as costly as the two together: the docs are what the next
  session reads first, and stale docs pointing at dead code send that session
  straight into files that no longer do anything.
- When deleting a superseded implementation, grep for every doc file that names it
  by path or component name in the same pass — do not treat "delete the code" and
  "correct the docs" as separable steps.

## Theme-Aware Utilities Can Override an Explicit Color Choice

- A component styled with `bg-white` rendered dark anyway, because a global
  stylesheet rewrote `.dark .bg-white` into a translucent dark glass for the rest of
  the app. The component was previewing a printed artifact (a visitor pass) that
  must never inherit the app's dark/light theme — it simulates a physical object
  with fixed real-world colors.
- Fix pattern: anything that previews a printed or physical artifact must opt out of
  theming with explicit color literals, not shared Tailwind utility classes that a
  global stylesheet is free to rewrite under a theme selector.

## Renaming a Live Column or RPC Parameter

- Postgres will not rename a function's input parameter via `CREATE OR REPLACE` — the
  migration must `DROP FUNCTION` (exact signature) and `CREATE FUNCTION` again.
- Dropping a function also drops its grants. A rename migration that touches a
  `security definer` RPC must re-`GRANT EXECUTE` to every role the original had, or the
  rename silently revokes access for whoever the drop caught by surprise (e.g. `anon`).
- Before renaming a column live, verify no index, RLS policy, or view references it by
  name — a rename that orphans a dependency fails loudly in Postgres, but only at
  migration time, not at review time.
