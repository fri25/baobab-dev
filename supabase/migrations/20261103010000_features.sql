-- Fonctions du MVP : recherche, notifications, matching, fil, classements

-- ============================================================
-- Recherche plein texte (repli du Griot sans clé d'embeddings, et recherche Q&A)
-- ============================================================
-- array_to_string n'est pas déclaré immuable : enveloppe pour la colonne générée
create or replace function public.tags_to_text(p_tags text[])
returns text language sql immutable parallel safe as $$
  select coalesce(array_to_string(p_tags, ' '), '');
$$;

alter table public.questions add column search tsvector
  generated always as (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', public.tags_to_text(tags)), 'B') ||
    setweight(to_tsvector('french', coalesce(body, '')), 'C')
  ) stored;
create index on public.questions using gin (search);

alter table public.answers add column search tsvector
  generated always as (to_tsvector('french', coalesce(body, ''))) stored;
create index on public.answers using gin (search);

-- Réponses fiables les plus proches d'une question, par mots-clés
create or replace function public.match_answers_text(p_query text, match_count integer default 5)
returns table (
  answer_id uuid, question_id uuid, question_title text, body text,
  author_id uuid, author_username text, author_city text, author_country text, similarity float
)
language sql stable security definer set search_path = public as $$
  with q as (select websearch_to_tsquery('french', p_query) as ts,
                    to_tsquery('french', array_to_string(
                      array(select lexeme from unnest(to_tsvector('french', p_query))), ' | ')) as any_ts)
  select a.id, qu.id, qu.title, a.body, p.id, p.username, p.city, p.country,
         (ts_rank(qu.search, q.any_ts) + ts_rank(a.search, q.any_ts))::float as similarity
  from answers a
  join questions qu on qu.id = a.question_id
  join profiles p on p.id = a.author_id, q
  where (a.is_accepted or a.score >= 2)
    and (qu.search @@ q.any_ts or a.search @@ q.any_ts)
  order by similarity desc
  limit match_count;
$$;

-- Questions proches (suggestions anti-doublon avant publication)
create or replace function public.similar_questions(p_query text, match_count integer default 5)
returns table (id uuid, title text, answers_count integer, has_accepted boolean, rank float)
language sql stable set search_path = public as $$
  with q as (select to_tsquery('french', array_to_string(
                      array(select lexeme from unnest(to_tsvector('french', p_query))), ' | ')) as any_ts)
  select qu.id, qu.title, qu.answers_count, qu.accepted_answer_id is not null,
         ts_rank(qu.search, q.any_ts)::float
  from questions qu, q
  where qu.search @@ q.any_ts
  order by 5 desc
  limit match_count;
$$;

-- ============================================================
-- Notifications automatiques
-- ============================================================
-- Nouvelle question : les experts du tag sont notifiés (§5.3)
create or replace function public.notify_question_experts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, payload)
  select distinct on (us.user_id) us.user_id, 'question_for_you',
         jsonb_build_object('question_id', new.id, 'title', new.title, 'skill', s.name)
  from user_skills us
  join skills s on s.id = us.skill_id
  where lower(s.name) = any (select lower(t) from unnest(new.tags) t)
    and us.user_id <> new.author_id
  order by us.user_id, us.weight desc
  limit 50;
  return new;
end $$;
create trigger questions_notify_experts after insert on public.questions
  for each row execute function public.notify_question_experts();

-- Nouvelle réponse : l'auteur de la question est notifié
create or replace function public.notify_new_answer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from questions where id = new.question_id;
  if v_author <> new.author_id then
    insert into notifications (user_id, kind, payload)
    values (v_author, 'new_answer', jsonb_build_object('question_id', new.question_id, 'answer_id', new.id));
  end if;
  return new;
end $$;
create trigger answers_notify after insert on public.answers
  for each row execute function public.notify_new_answer();

-- Candidature à une Squad : le porteur est notifié
create or replace function public.notify_squad_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'applied' then
    insert into notifications (user_id, kind, payload)
    select s.owner_id, 'squad_application', jsonb_build_object('squad_id', s.id, 'name', s.name, 'user_id', new.user_id)
    from squads s where s.id = new.squad_id;
  elsif new.status = 'invited' then
    insert into notifications (user_id, kind, payload)
    select new.user_id, 'squad_invitation', jsonb_build_object('squad_id', s.id, 'name', s.name)
    from squads s where s.id = new.squad_id;
  end if;
  return new;
end $$;
create trigger squad_members_notify after insert on public.squad_members
  for each row execute function public.notify_squad_application();

-- Abondement : le créateur du ticket est notifié
create or replace function public.notify_bounty_contribution()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_creator uuid;
begin
  select creator_id into v_creator from bounties where id = new.bounty_id;
  if v_creator <> new.user_id then
    insert into notifications (user_id, kind, payload)
    values (v_creator, 'bounty_contribution', jsonb_build_object('bounty_id', new.bounty_id, 'amount', new.amount, 'user_id', new.user_id));
  end if;
  return new;
end $$;
create trigger bounty_contributions_notify after insert on public.bounty_contributions
  for each row execute function public.notify_bounty_contribution();

-- ============================================================
-- Matching des Squads (§5.5) : compétences, disponibilité, réputation
-- ============================================================
create or replace function public.match_squad_candidates(p_squad_id uuid, match_count integer default 10)
returns table (
  user_id uuid, username text, full_name text, avatar_url text, city text, country text,
  xp integer, availability text, matched_skills text[], score float
)
language sql stable security definer set search_path = public as $$
  with sq as (select * from squads where id = p_squad_id),
  needed as (select lower(unnest(skills_needed)) as name from sq)
  select p.id, p.username, p.full_name, p.avatar_url, p.city, p.country, p.xp, p.availability,
         array_agg(s.name order by us.weight desc),
         (count(*) * 10
           + sum(least(us.weight, 10))
           + case p.availability when 'available' then 15 when 'limited' then 5 else 0 end
           + ln(greatest(p.xp, 1)) * 2)::float as score
  from profiles p
  join user_skills us on us.user_id = p.id
  join skills s on s.id = us.skill_id
  where lower(s.name) in (select name from needed)
    and p.id <> (select owner_id from sq)
    and not exists (select 1 from squad_members m where m.squad_id = p_squad_id and m.user_id = p.id)
  group by p.id
  order by score desc
  limit match_count;
$$;

-- ============================================================
-- Fil personnalisé (§5.2)
-- ============================================================
create or replace function public.my_skill_names()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(lower(s.name)), '{}')
  from user_skills us join skills s on s.id = us.skill_id
  where us.user_id = auth.uid();
$$;

create or replace function public.feed_questions(p_limit integer default 6)
returns setof public.questions language sql stable security definer set search_path = public as $$
  select * from questions
  where author_id <> auth.uid()
    and exists (select 1 from unnest(tags) t where lower(t) = any (my_skill_names()))
  order by created_at desc
  limit p_limit;
$$;

-- ============================================================
-- Classements par ville, pays et continent (§5.7)
-- ============================================================
create or replace function public.leaderboard(p_scope text default 'continent', p_value text default null, p_limit integer default 50)
returns table (rank bigint, user_id uuid, username text, full_name text, avatar_url text, city text, country text, xp integer)
language sql stable set search_path = public as $$
  select row_number() over (order by xp desc, created_at), id, username, full_name, avatar_url, city, country, xp
  from profiles
  where case p_scope
          when 'country' then country = p_value
          when 'city' then city = p_value
          else true
        end
  order by xp desc, created_at
  limit p_limit;
$$;

-- ============================================================
-- Showroom : projet de la semaine (+50 XP) et appel à contributeurs
-- ============================================================
create or replace function public.elect_project_of_week(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not is_moderator() then raise exception 'Réservé à la modération'; end if;
  update projects set project_of_week_at = current_date where id = p_project_id returning owner_id into v_owner;
  perform add_points(v_owner, 50, 'project_of_week', 'project', p_project_id);
  perform award_badge(v_owner, 'batisseur_argent');
end $$;

-- ============================================================
-- Modération (§8.5)
-- ============================================================
create or replace function public.moderate_report(p_report_id bigint, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r reports%rowtype; v_author uuid;
begin
  if not is_moderator() then raise exception 'Réservé à la modération'; end if;
  select * into r from reports where id = p_report_id for update;

  if p_action = 'remove' then
    if r.target_type = 'question' then
      delete from questions where id = r.target_id returning author_id into v_author;
    elsif r.target_type = 'answer' then
      delete from answers where id = r.target_id returning author_id into v_author;
    elsif r.target_type = 'project' then
      delete from projects where id = r.target_id returning owner_id into v_author;
    elsif r.target_type = 'comment' then
      delete from comments where id = r.target_id returning author_id into v_author;
    end if;
    -- Contenu supprimé : -15 XP (§5.7)
    if v_author is not null then
      perform add_points(v_author, -15, 'content_removed', r.target_type, r.target_id);
    end if;
    update reports set status = 'actioned', handled_by = auth.uid()
    where target_type = r.target_type and target_id = r.target_id and status = 'open';
  else
    update reports set status = 'dismissed', handled_by = auth.uid() where id = p_report_id;
  end if;
end $$;

-- Pair-Debugging : compteur d'octets échangés (preuve des < 5 Ko/s)
create or replace function public.add_debug_bytes(p_session_id uuid, p_bytes bigint)
returns void language sql security definer set search_path = public as $$
  update debug_sessions set bytes_sent = bytes_sent + greatest(p_bytes, 0)
  where id = p_session_id and in_debug_session(p_session_id);
$$;

-- Quota quotidien du Griot (§11 : gratuit avec quota)
create or replace function public.griot_queries_today(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from griot_queries where user_id = p_user and created_at > date_trunc('day', now());
$$;
