-- Sync department_id into auth.users metadata so HOD page reads it from JWT
-- instead of querying profiles (which triggers RLS recursion).
create or replace function public.sync_profile_role_to_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', new.role, 'department_id', new.department_id)
  where id = new.id;
  return new;
end;
$$;

-- Also fire on department_id changes, not just role changes.
drop trigger if exists sync_profile_role on public.profiles;
create trigger sync_profile_role
  after insert or update of role, department_id on public.profiles
  for each row execute function public.sync_profile_role_to_auth();

-- Backfill existing profiles so current HODs get their department_id into JWT.
do $$
declare
  r record;
begin
  for r in select id, role, department_id from public.profiles where department_id is not null loop
    update auth.users
    set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', r.role, 'department_id', r.department_id)
    where id = r.id;
  end loop;
end;
$$;
