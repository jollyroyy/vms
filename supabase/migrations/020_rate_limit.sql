-- 020 — Login rate limiting (DDoS / brute-force protection)
-- Tracks failed login attempts per IP / email and enforces cooldown.
-- Client-side rate limiter in src/lib/rateLimiter.ts is the first line of defense.
-- This provides server-side enforcement via a helper function.

-- 1) Table to track login attempts
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address text not null default '',
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists idx_login_attempts_email on public.login_attempts(email, attempted_at desc);
create index if not exists idx_login_attempts_ip on public.login_attempts(ip_address, attempted_at desc);

-- 2) Enable RLS (no direct user access; used by triggers/RPCs)
alter table public.login_attempts enable row level security;

-- 3) Grant insert so the client can record attempts
grant insert on public.login_attempts to authenticated, anon;

-- 4) Helper: check if login should be rate-limited
create or replace function public.check_login_rate_limit(p_email text)
returns table (
  blocked boolean,
  remaining_seconds int,
  message text
) language plpgsql stable as $$
declare
  v_recent_attempts int;
  v_first_attempt timestamptz;
  v_cooldown_seconds int;
begin
  select count(*), min(attempted_at)
  into v_recent_attempts, v_first_attempt
  from public.login_attempts
  where email = p_email
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if v_recent_attempts >= 5 then
    v_cooldown_seconds := power(2, v_recent_attempts - 5)::int * 30;
    if v_cooldown_seconds > 1800 then v_cooldown_seconds := 1800; end if;
    return query select true, v_cooldown_seconds, format('Too many failed attempts. Try again in %s seconds.', v_cooldown_seconds);
  else
    return query select false, 0, ''::text;
  end if;
end;
$$;

-- 5) Function to record a login attempt
create or replace function public.record_login_attempt(p_email text, p_success boolean)
returns void language plpgsql security definer as $$
begin
  insert into public.login_attempts (email, ip_address, success)
  values (p_email, coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'), p_success);
end;
$$;

grant execute on function public.check_login_rate_limit(text) to authenticated, anon;
grant execute on function public.record_login_attempt(text, boolean) to authenticated, anon;
