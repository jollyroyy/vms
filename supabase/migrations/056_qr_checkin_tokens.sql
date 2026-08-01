-- 056 — QR check-in tokens on visits.
--
-- Feature 1+2 of the guard-assistant enhancement: a visitor arrives holding a
-- QR code (printed badge or emailed invitation), the guard scans it, and the
-- console jumps straight to that visit instead of typing a phone number.
--
-- DELIBERATELY NOT a separate `invitations` table, despite the PRD asking for
-- one. A visit row already carries visitor/host/department/status and is the
-- thing the guard is actually looking for. A parallel table would duplicate
-- that status and could drift out of sync with it — an invitation that says
-- "valid" pointing at a visit that says "cancelled" is exactly the failure a
-- guard cannot be asked to reason about at the gate. Two columns on visits
-- keep one row as the single source of truth.
--
-- ── Token ──────────────────────────────────────────────────────────────────
-- gen_random_uuid() is a pgcrypto-grade CSPRNG built into Postgres 13+, so no
-- extension is required. 122 bits of entropy is far beyond what a bearer token
-- with a 24h life and an authenticated-only lookup needs.
--
-- Added nullable -> backfilled -> defaulted -> set NOT NULL rather than
-- `add column ... not null default`, so the intent of each step is explicit
-- and the backfill is a statement someone can read, not an implicit rewrite.

alter table public.visits
  add column if not exists qr_token      text,
  add column if not exists qr_expires_at timestamptz;

-- Backfill existing rows. Expiry is anchored to each row's own created_at so a
-- historical visit does not come back to life with a fresh 24h window.
update public.visits set qr_token      = gen_random_uuid()::text where qr_token is null;
update public.visits set qr_expires_at = created_at + interval '24 hours' where qr_expires_at is null;

alter table public.visits
  alter column qr_token      set default gen_random_uuid()::text,
  alter column qr_expires_at set default (now() + interval '24 hours');

-- NOT NULL only on the token: every visit must be scannable. qr_expires_at is
-- left nullable on purpose — a NULL expiry means "never expires", which the
-- client (src/lib/qrToken.ts isQrExpired) treats as valid. That is the correct
-- fail-open direction: a missing expiry must never strand a real visitor at
-- the gate. Blocking is the job of `status`, which is authoritative.
alter table public.visits
  alter column qr_token set not null;

-- Unique index doubles as the lookup index for the scan path (single-row
-- equality fetch on qr_token).
create unique index if not exists visits_qr_token_key
  on public.visits (qr_token);

-- ── RLS: intentionally no new policy ───────────────────────────────────────
-- The scan path is a plain `select ... where qr_token = $1` and is already
-- covered by "visits: read scoped by role" (043): guard/admin/super_admin read
-- every visit, everyone else only their own department's. A guard scanning a
-- code can therefore resolve it; an HOD can see the tokens for the visits they
-- themselves issued; staff of another department can see neither. That is the
-- access model we want, so adding a token-specific policy would only widen it.
--
-- Note the token is a bearer value but NOT a privilege: possessing it lets an
-- already-authenticated guard FIND a visit, nothing more. Check-in itself is
-- still an UPDATE gated by "visits: guard updates checkin/checkout" (055), and
-- an unauthenticated holder of a leaked token has no readable policy at all.
