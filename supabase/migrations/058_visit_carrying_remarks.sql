-- 058 — visits.carrying_remarks
--
-- At check-in the guard can record what the visitor is carrying (laptop make,
-- bags, material, etc.). visits.carrying_material already says *whether*
-- anything is carried; this column captures *what*, in the guard's own words.
-- Written only by the guard's check-in flow (src/pages/Guard/CheckInPanel.tsx).

alter table public.visits
  add column if not exists carrying_remarks text;

-- PostgREST caches the table schema. Without this the API keeps rejecting writes
-- with "Could not find the 'carrying_remarks' column of 'visits' in the schema
-- cache" until the connection pooler is restarted.
notify pgrst, 'reload schema';
