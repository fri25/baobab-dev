-- Images dans les réponses (même stockage que les questions)

alter table public.answers add column images text[] not null default '{}'
  check (cardinality(images) <= 4);

grant update (images) on public.answers to authenticated;
