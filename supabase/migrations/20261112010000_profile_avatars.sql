insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 3145728, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

create policy "déposer sa photo de profil" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "supprimer sa photo de profil" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lire les photos de profil" on storage.objects for select
  using (bucket_id = 'profile-avatars');
