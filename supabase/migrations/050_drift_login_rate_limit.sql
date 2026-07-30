-- 050 — DRIFT RECONCILIATION 5/10: login rate limiting (from 020).
--
-- 020_rate_limit.sql was never applied: public.login_attempts,
-- check_login_rate_limit() and record_login_attempt() are all absent live.
-- Nothing in src/ calls them yet (the client-side limiter in
-- src/lib/rateLimiter.ts is the only thing running today), so this is dormant
-- capability rather than a live bug — but the file claims it exists, so it is
-- reconciled here.
--
-- FIX vs 020: check_login_rate_limit() was declared `stable` WITHOUT
-- `security definer`, while login_attempts has RLS enabled and no SELECT
-- policy. As written in 020 the count would always come back 0 for every
-- caller, so the limiter could never fire. It is security definer here, with a
-- pinned empty search_path, so it can actually read the table it depends on.

create table if not exists public.login_attempts (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  ip_address    text not null default '',
  attempted_at  timestamptz not null default now(),
  success       boolean not null default false
);

create index if not exists idx_login_attempts_email
  on public.login_attempts(email, attempted_at desc);
create index if not exists idx_login_attempts_ip
  on public.login_attempts(ip_address, attempted_at desc);

-- RLS on with no SELECT/UPDATE/DELETE policy: the table is reachable only
-- through the two definer functions below. INSERT is granted so an
-- unauthenticated login attempt can still be recorded.
alter table public.login_attempts enable row level security;
grant insert on public.login_attempts to authenticated, anon;

create or replace function public.check_login_rate_limit(p_email text)
returns table (
  blocked boolean,
  remaining_seconds int,
  message text
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_recent_attempts int;
  v_cooldown_seconds int;
begin
  select count(*)
  into v_recent_attempts
  from public.login_attempts
  where email = p_email
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if v_recent_attempts >= 5 then
    v_cooldown_seconds := power(2, v_recent_attempts - 5)::int * 30;
    if v_cooldown_seconds > 1800 then v_cooldown_seconds := 1800; end if;
    return query select true, v_cooldown_seconds,
      format('Too many failed attempts. Try again in %s seconds.', v_cooldown_seconds);
  else
    return query select false, 0, ''::text;
  end if;
end;
$$;

create or replace function public.record_login_attempt(p_email text, p_success boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.login_attempts (email, ip_address, success)
  values (
    p_email,
    coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'),
    p_success
  );
end;
$$;

grant execute on function public.check_login_rate_limit(text) to authenticated, anon;
grant execute on function public.record_login_attempt(text, boolean) to authenticated, anon;
