-- 053 — DRIFT RECONCILIATION 8/10: avatars storage bucket (from 033).
--
-- LIVE BUG: src/components/layout/SidebarProfile.tsx uploads to the `avatars`
-- bucket and then writes the public URL to profiles.avatar_url (:58). Live
-- storage.buckets holds only `pass-images` and `visitor-photos` — there is no
-- `avatars` bucket and none of 033's four storage policies exist. Avatar
-- upload fails today for every role. (The column itself is added in 047.)
--
-- 033's policies had no `drop policy if exists`, so replaying it against a
-- project where it HAD landed would error. Made idempotent here.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Upload own avatar only: first path segment must be the caller's user id.
drop policy if exists "avatars: users can upload own avatar" on storage.objects;
create policy "avatars: users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public bucket, so images resolve without a signed URL.
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars: users can update own avatar" on storage.objects;
create policy "avatars: users can update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: users can delete own avatar" on storage.objects;
create policy "avatars: users can delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
