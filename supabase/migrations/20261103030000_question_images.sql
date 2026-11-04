-- Images dans les questions (captures d'écran d'erreurs, maquettes…)

alter table public.questions add column images text[] not null default '{}'
  check (cardinality(images) <= 4);

grant update (images) on public.questions to authenticated;

-- Stockage public, compressé côté client (WebP), 1 Mo maximum par fichier
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 1048576, '{image/webp,image/jpeg,image/png,image/gif}')
on conflict (id) do nothing;

-- Chacun dépose dans son propre dossier : <user_id>/<fichier>
create policy "déposer ses images" on storage.objects for insert to authenticated
  with check (bucket_id = 'question-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "supprimer ses images" on storage.objects for delete to authenticated
  using (bucket_id = 'question-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lire les images" on storage.objects for select
  using (bucket_id = 'question-images');
