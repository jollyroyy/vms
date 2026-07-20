-- Security-definer RPC to fetch profile names without triggering RLS recursion.
-- All pages that previously joined `profiles` (Approvals, WhosInside, Console, Reports)
-- would hit "infinite recursion detected in policy for relation 'profiles'" due to
-- the `current_user_role()` calls in UPDATE policies on PG15+.
-- This function bypasses RLS entirely for this narrow read.
create or replace function public.get_profile_names(profile_ids uuid[])
returns table (id uuid, full_name text, role public.user_role)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select p.id, p.full_name, p.role
    from public.profiles p
    where p.id = any(profile_ids);
end;
$$;
