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
