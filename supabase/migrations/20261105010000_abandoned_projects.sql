-- V2 : détecteur de projets abandonnés (§7.3)

alter table public.projects
  add column repo_stars integer,
  add column repo_forks integer,
  add column unanswered_issues integer,
  add column repo_checked_at timestamptz,
  add column abandon_status text check (abandon_status in ('detected', 'revival', 'ceded', 'archived', 'adopted')),
  add column abandon_detected_at timestamptz,
  add column founder_id uuid references public.profiles (id) on delete set null, -- reste crédité après une cession
  add column adopted_at timestamptz;
create index on public.projects (abandon_status);

insert into public.badges (code, name, category, tier, description) values
  ('passeur_flambeau_bronze', 'Passeur de flambeau', 'construction', 'bronze', 'A cédé un projet pour qu''il soit relancé par la communauté')
on conflict (code) do nothing;

-- Statistiques du dépôt, relevées par le serveur (tâche quotidienne ou vérification à la demande)
create or replace function public.set_project_repo_stats(
  p_project uuid, p_last_commit timestamptz, p_stars integer, p_forks integer, p_unanswered integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare p projects%rowtype; v_detected boolean;
begin
  select * into p from projects where id = p_project for update;
  -- Abandonné : pas de commit depuis 6 mois, issues sans réponse, et un intérêt passé
  v_detected := p_last_commit < now() - interval '6 months'
                and coalesce(p_unanswered, 0) > 0
                and coalesce(p_stars, 0) + coalesce(p_forks, 0) > 0;

  update projects set last_commit_at = p_last_commit, repo_stars = p_stars, repo_forks = p_forks,
                      unanswered_issues = p_unanswered, repo_checked_at = now()
  where id = p_project;

  if v_detected and p.abandon_status is null then
    update projects set abandon_status = 'detected', abandon_detected_at = now(), status = 'abandoned' where id = p_project;
    insert into notifications (user_id, kind, payload)
    values (p.owner_id, 'project_abandoned', jsonb_build_object('slug', p.slug, 'name', p.name));
  elsif not v_detected and p.abandon_status = 'detected' then
    -- Le dépôt a repris vie tout seul
    update projects set abandon_status = null, abandon_detected_at = null, status = 'building' where id = p_project;
  end if;
  return v_detected;
end $$;
revoke execute on function public.set_project_repo_stats from public, anon, authenticated;

-- Choix du propriétaire : relancer avec une Squad, céder, ou archiver
create or replace function public.decide_abandoned_project(p_project uuid, p_choice text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p projects%rowtype; v_squad uuid;
begin
  select * into p from projects where id = p_project for update;
  if p.owner_id is distinct from auth.uid() then raise exception 'Seul le propriétaire décide du sort du projet'; end if;
  if p.abandon_status not in ('detected', 'archived') then raise exception 'Ce projet n''est pas en sommeil'; end if;

  if p_choice = 'relancer' then
    insert into squads (owner_id, project_id, name, description, roles_needed, skills_needed, status)
    values (p.owner_id, p.id, 'Relance de ' || p.name,
            'Ce projet a de l''intérêt (' || coalesce(p.repo_stars, 0) || ' étoiles, ' || coalesce(p.unanswered_issues, 0)
              || ' issues en attente) mais est à l''arrêt depuis plusieurs mois. Aide à le relancer !',
            '{Contributeur}', p.stack, 'recruiting')
    returning id into v_squad;
    update projects set abandon_status = 'revival', status = 'building', looking_for_contributors = true, squad_id = v_squad
    where id = p.id;
    return v_squad;
  elsif p_choice = 'ceder' then
    update projects set abandon_status = 'ceded', founder_id = coalesce(founder_id, owner_id) where id = p.id;
  elsif p_choice = 'archiver' then
    update projects set abandon_status = 'archived', status = 'paused' where id = p.id;
  else
    raise exception 'Choix invalide';
  end if;
  return null;
end $$;

-- Reprise d'un projet cédé : le repreneur devient propriétaire, le fondateur reste crédité et reçoit un badge
create or replace function public.adopt_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p projects%rowtype; v_name text;
begin
  select * into p from projects where id = p_project for update;
  if p.abandon_status <> 'ceded' then raise exception 'Ce projet n''est pas à reprendre'; end if;
  if p.owner_id = auth.uid() then raise exception 'Tu es déjà propriétaire de ce projet'; end if;
  select coalesce(full_name, username) into v_name from profiles where id = auth.uid();

  update projects set owner_id = auth.uid(), abandon_status = 'adopted', adopted_at = now(), status = 'building'
  where id = p.id;
  perform award_badge(p.founder_id, 'passeur_flambeau_bronze');
  perform add_points(auth.uid(), 15, 'project_adopted', 'project', p.id);
  insert into notifications (user_id, kind, payload)
  values (p.founder_id, 'project_adopted', jsonb_build_object('slug', p.slug, 'name', p.name, 'by', v_name));
end $$;

-- Les champs de détection ne sont modifiables que par ces fonctions
revoke update on public.projects from authenticated, anon;
grant update (name, slug, description, screenshots, demo_url, repo_url, stack, status,
              looking_for_contributors, squad_id, updated_at) on public.projects to authenticated;
