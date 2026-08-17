-- 085 — the visitor's email, and whether an invitation went out.
--
-- The admin Pre-Registration board lists an Email column and an "Invitation
-- Sent" Yes/No beside the status. Neither existed: `visitors` carried a phone
-- and nothing else reachable, and a pre-approval recorded no attempt to tell
-- the visitor about it. The pass could be raised, downloaded, and never reach
-- the person it was for — which is the same gap `lib/sharePass.ts` closed by
-- hand on the WhatsApp side.
--
-- EMAIL IS OPTIONAL AND WILL STAY OPTIONAL. `visitors.phone` is the identity
-- column (unique, and migration 060's one-open-visit rule is built on it); a
-- walk-in at the gate gives a phone and a name, and demanding an address from
-- someone standing at reception would block the registration this system exists
-- to make fast. Null email means "we never asked", which is the truth.
--
-- `invitation_sent_at` is a TIMESTAMP, not a boolean. "Yes" and "when" are the
-- same column that way, and a re-send overwrites with the later moment rather
-- than leaving a flag that cannot say whether it was this morning or last week.

alter table public.visitors add column if not exists email text;

-- A deliberately loose shape check: one @, no spaces, a dot in the domain. It
-- is a typo guard, not an address validator — RFC 5322 conformance is not
-- something a CHECK constraint should attempt, and the only authority on
-- whether an address works is a delivery attempt.
alter table public.visitors drop constraint if exists visitors_email_shape;
alter table public.visitors add constraint visitors_email_shape
  check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- Case-insensitively unique where present, so one person is one visitor row
-- whichever way their address is capitalised. Partial, because null is the
-- common case and nulls must not collide with each other.
create unique index if not exists visitors_email_key
  on public.visitors (lower(email)) where email is not null;

alter table public.visits add column if not exists invitation_sent_at timestamptz;

-- An invitation cannot have been sent to nobody. Enforced here rather than in
-- the client because the pre-approval RPC, the admin board and any future
-- resend job are three write paths and a component check can be raced.
alter table public.visits drop constraint if exists visits_invite_needs_email;
alter table public.visits add constraint visits_invite_needs_email
  check (invitation_sent_at is null or visitor_id is not null);
