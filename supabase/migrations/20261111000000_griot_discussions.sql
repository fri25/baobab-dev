alter table public.griot_queries
  add column escalated_conversation_id uuid references public.conversations (id) on delete set null;

alter table public.messages
  drop constraint if exists messages_body_check,
  add constraint messages_body_check check (char_length(body) between 1 and 12000);

create or replace function public.request_griot_review(p_query_id uuid, p_tags text[])
returns table (conversation_id uuid, notified_experts integer)
language plpgsql security definer set search_path = public as $$
declare
  v_query public.griot_queries%rowtype;
  v_conversation_id uuid;
  v_title text;
  v_tags text[] := coalesce(p_tags[1:5], '{}');
  v_notified integer := 0;
  v_username text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select * into v_query
  from public.griot_queries
  where id = p_query_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Réponse du Griot introuvable'; end if;

  if v_query.escalated_conversation_id is not null then
    select count(*)::int into v_notified
    from public.notifications n
    where n.kind = 'griot_review'
      and n.payload ->> 'conversation_id' = v_query.escalated_conversation_id::text;
    return query select v_query.escalated_conversation_id, v_notified;
    return;
  end if;

  if v_query.status not in ('answered', 'escalated') or v_query.answer is null then
    raise exception 'Seules les réponses du Griot peuvent être soumises à validation';
  end if;

  select username into v_username from public.profiles where id = auth.uid();
  v_title := left('Avis d’expert · ' || trim(v_query.question), 80);

  insert into public.conversations (kind, title, description, tags, created_by)
  values (
    'topic',
    v_title,
    'La question et la réponse proposée par le Griot ont été partagées par leur auteur pour une vérification publique.',
    v_tags,
    auth.uid()
  )
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conversation_id, auth.uid(), 'owner');

  insert into public.messages (conversation_id, author_id, body)
  values (
    v_conversation_id,
    auth.uid(),
    'Demande de validation du Griot' || E'\n\n'
      || 'Question de @' || coalesce(v_username, 'membre') || E' :\n'
      || v_query.question || E'\n\n'
      || 'Réponse proposée par le Griot (à vérifier) :' || E'\n'
      || v_query.answer || E'\n\n'
      || 'Merci aux experts de la communauté de vérifier, corriger ou compléter cette réponse.'
  );

  with expert_matches as (
    select distinct on (p.id) p.id as user_id, s.name as skill, p.xp, us.weight
    from public.profiles p
    join public.user_skills us on us.user_id = p.id
    join public.skills s on s.id = us.skill_id
    where p.id <> auth.uid()
      and p.role = 'developer'
      and p.xp >= 2000
      and lower(s.name) = any (select lower(tag) from unnest(v_tags) tag)
    order by p.id, us.weight desc, p.xp desc, s.name
  ),
  fallback_experts as (
    select p.id as user_id, 'compétence à confirmer'::text as skill, p.xp, 0 as weight
    from public.profiles p
    where p.id <> auth.uid()
      and p.role = 'developer'
      and p.xp >= 2000
      and not exists (select 1 from expert_matches)
    order by p.xp desc
    limit 5
  ),
  candidates as (
    select em.user_id, em.skill, em.xp, em.weight from expert_matches em
    union all
    select fe.user_id, fe.skill, fe.xp, fe.weight from fallback_experts fe
  ),
  recipients as (
    select c.user_id, c.skill
    from candidates c
    order by c.xp desc, c.weight desc, c.user_id
    limit 50
  )
  insert into public.notifications (user_id, kind, payload)
  select r.user_id, 'griot_review',
    jsonb_build_object(
      'conversation_id', v_conversation_id,
      'title', v_title,
      'skill', r.skill
    )
  from recipients r;
  get diagnostics v_notified = row_count;

  update public.griot_queries
  set status = 'escalated', escalated_conversation_id = v_conversation_id
  where id = v_query.id;

  return query select v_conversation_id, v_notified;
end $$;

revoke all on function public.request_griot_review(uuid, text[]) from public, anon;
grant execute on function public.request_griot_review(uuid, text[]) to authenticated;
