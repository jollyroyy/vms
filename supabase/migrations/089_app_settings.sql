-- 089 — application settings.
--
-- The admin Settings screen is six sections of toggles and pickers. Every one
-- of them was previously a constant compiled into the bundle — which, on a
-- Vercel deployment, means unchangeable from the running app. That is exactly
-- the trap the deleted `qr` feature flag fell into (see CLAUDE.md): Vite inlines
-- `import.meta.env.*` at BUILD time, so a setting that lives in the source is
-- not a setting, it is a decision someone has to redeploy to revisit.
--
-- KEY/VALUE, not a wide single-row table. A columns-per-setting table needs a
-- migration for every new toggle and a schema-cache reload before the app can
-- read it; a key/value store lets a section grow without touching the database
-- again. The cost is that nothing enforces the SHAPE of a value — which is why
-- `src/lib/appSettings.ts` owns the typed schema on the client and coerces on
-- read, so a corrupt or missing row falls back to the documented default rather
-- than rendering `undefined` into a toggle.
--
-- VALUE IS JSONB so a setting can be a boolean, a number or a string without
-- three columns and a discriminator. `to_jsonb(false)`, not `'false'`.

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- Keys are dotted, lowercase, section-prefixed. Constrained because the
-- section a setting belongs to is derived from its prefix on the client — a
-- key with a typo would render into no section at all and look like a missing
-- feature rather than a bad row.
alter table public.app_settings drop constraint if exists app_settings_key_format;
alter table public.app_settings add constraint app_settings_key_format
  check (key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$');

-- ── Seed: the documented defaults ───────────────────────────────────────────
-- These are the values the app behaved with before it had a settings table, so
-- applying this migration changes nothing until an admin moves a switch. Every
-- key here has a matching entry in `src/lib/appSettings.ts`; the two are one
-- schema in two places and must be edited together.
--
-- `on conflict do nothing` — a re-run must never stamp an admin's choice back
-- to the default.
insert into public.app_settings (key, value) values
  -- General
  ('general.facility_name',            to_jsonb('Quest Mall'::text)),
  ('general.timezone',                 to_jsonb('Asia/Kolkata'::text)),
  -- Check-in rules. The first three are ALREADY TRUE of the code today
  -- (a photo is mandatory on every check-in path, the card number gates the
  -- confirm button, the ID scan gates the walk-in form) — seeding them false
  -- would silently loosen four gates on the day this applies.
  ('checkin.require_photo',            to_jsonb(true)),
  ('checkin.require_id_scan',          to_jsonb(true)),
  ('checkin.require_card_number',      to_jsonb(true)),
  ('checkin.require_nda',              to_jsonb(false)),
  ('checkin.walkin_without_host',      to_jsonb(false)),
  ('checkin.auto_signout_hours',       to_jsonb(12)),
  -- Badges
  ('badges.printing_enabled',          to_jsonb(true)),
  ('badges.default_type',              to_jsonb('visitor'::text)),
  ('badges.show_photo',                to_jsonb(true)),
  ('badges.show_qr',                   to_jsonb(true)),
  -- Notifications. `overdue_nudge_minutes` mirrors migration 070's scheduled
  -- `nudge_overdue_visits(120)`; changing it here does NOT reschedule the cron
  -- job, and the Settings screen says so on the field.
  ('notify.host_email_on_arrival',     to_jsonb(true)),
  ('notify.host_sms_on_arrival',       to_jsonb(false)),
  ('notify.host_signout_reminder',     to_jsonb(true)),
  ('notify.signout_reminder_time',     to_jsonb('17:00'::text)),
  ('notify.overdue_nudge_minutes',     to_jsonb(120)),
  -- Pre-registration
  ('prereg.email_invites',             to_jsonb(false)),
  ('prereg.public_link',               to_jsonb(false)),
  ('prereg.whatsapp_share',            to_jsonb(true)),
  -- Integrations
  ('integrations.whatsapp_enabled',    to_jsonb(true)),
  ('integrations.email_enabled',       to_jsonb(true)),
  ('integrations.webhook_url',         to_jsonb(''::text)),
  -- Kiosk
  ('kiosk.enabled',                    to_jsonb(true)),
  ('kiosk.language',                   to_jsonb('en'::text)),
  ('kiosk.idle_reset_seconds',         to_jsonb(60))
on conflict (key) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.app_settings enable row level security;

-- EVERY signed-in role reads. A setting that only the admin can see cannot
-- change how the gate behaves, and changing how the gate behaves is the entire
-- point of the screen — `checkin.require_photo` is read by the guard's
-- check-in flow, `kiosk.*` by a device with no admin anywhere near it.
drop policy if exists "app_settings: authenticated read" on public.app_settings;
create policy "app_settings: authenticated read"
  on public.app_settings for select
  to authenticated
  using (true);

-- Only an admin writes, and `updated_by` must be their own id — a settings row
-- that can name someone else as the last editor is not an audit trail.
drop policy if exists "app_settings: admin updates" on public.app_settings;
create policy "app_settings: admin updates"
  on public.app_settings for update
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (
    public.current_user_role() in ('admin', 'super_admin')
    and (updated_by is null or updated_by = auth.uid())
  );

-- Insert is admin-only as well, so a new key can be added without a migration.
-- There is NO delete policy: removing a key makes the client fall back to a
-- default silently, which is indistinguishable from the setting having been
-- turned back on by itself.
drop policy if exists "app_settings: admin inserts" on public.app_settings;
create policy "app_settings: admin inserts"
  on public.app_settings for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'super_admin')
    and (updated_by is null or updated_by = auth.uid())
  );

-- Stamp the moment on every write, so the screen can say when a rule last
-- changed without trusting the client to send a timestamp.
create or replace function public.touch_app_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings
  before update on public.app_settings
  for each row execute function public.touch_app_settings();
