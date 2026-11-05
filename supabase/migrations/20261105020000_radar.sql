-- V2 : Radar d'opportunités cachées (§7.4)
-- Besoins publiés par les organisations ou collectés (appels d'offres), extraits par IA, associés aux profils et Squads.

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('publiee', 'collectee')),
  publisher_id uuid references public.profiles (id) on delete set null,
  organization_name text not null,
  org_type text not null default 'pme' check (org_type in ('pme', 'ong', 'collectivite', 'startup', 'entreprise')),
  title text not null,
  raw_text text not null,
  need text not null, -- besoin extrait, en une ou deux phrases
  technologies text[] not null default '{}',
  budget_min bigint,
  budget_max bigint,
  deadline date,
  country text,
  city text,
  contact text,
  source_url text unique, -- évite les doublons de la collecte
  extracted_by text not null default 'regles' check (extracted_by in ('ia', 'regles', 'manuel')),
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);
create index on public.opportunities (status, created_at desc);

create table public.opportunity_matches (
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'squad')),
  target_id uuid not null,
  score integer not null check (score between 0 and 100),
  reasons text[] not null default '{}',
  notified boolean not null default false,
  primary key (opportunity_id, target_type, target_id)
);
create index on public.opportunity_matches (target_type, target_id, score desc);

create table public.opportunity_responses (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  responder_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid references public.squads (id) on delete set null,
  message text not null check (char_length(message) between 20 and 3000),
  proposed_budget bigint,
  status text not null default 'sent' check (status in ('sent', 'shortlisted', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (opportunity_id, responder_id)
);

-- Sources de collecte (flux RSS ou Atom d'appels d'offres)
create table public.radar_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  country text,
  active boolean not null default true,
  last_fetched_at timestamptz
);

-- Alertes WhatsApp (opt-in)
alter table public.profiles add column whatsapp_number text check (whatsapp_number ~ '^\+?[0-9]{8,15}$');
alter table public.profiles add column whatsapp_alerts boolean not null default false;
grant update (whatsapp_number, whatsapp_alerts) on public.profiles to authenticated;

-- ============================================================
-- Score de correspondance
-- ============================================================
-- Profils : 15 points par technologie en commun (60 max), pays +15, ville +5, disponibilité +10/+5, réputation jusqu'à +10
create or replace function public.compute_opportunity_matches(p_opportunity uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare o opportunities%rowtype; v_n integer;
begin
  select * into o from opportunities where id = p_opportunity;
  delete from opportunity_matches where opportunity_id = p_opportunity and not notified;

  insert into opportunity_matches (opportunity_id, target_type, target_id, score, reasons)
  select o.id, 'user', m.user_id, least(100, m.score)::int, m.reasons
  from (
    select p.id as user_id,
           least(60, count(*) * 15)
             + case when p.country = o.country then 15 else 0 end
             + case when p.city = o.city then 5 else 0 end
             + case p.availability when 'available' then 10 when 'limited' then 5 else 0 end
             + least(10, ln(greatest(p.xp, 1)) * 1.2) as score,
           array_remove(array[
             'Compétences : ' || string_agg(s.name, ', ' order by s.name),
             case when p.country = o.country then 'Basé·e au ' || p.country end,
             case when p.availability = 'available' then 'Disponible' end
           ], null) as reasons
    from profiles p
    join user_skills us on us.user_id = p.id
    join skills s on s.id = us.skill_id
    where lower(s.name) in (select lower(t) from unnest(o.technologies) t)
      and p.id is distinct from o.publisher_id
    group by p.id
  ) m
  order by m.score desc
  limit 50
  on conflict (opportunity_id, target_type, target_id) do update set score = excluded.score, reasons = excluded.reasons;

  -- Squads : compétences recherchées et compétences de ses membres
  insert into opportunity_matches (opportunity_id, target_type, target_id, score, reasons)
  select o.id, 'squad', m.squad_id, least(100, m.score)::int, m.reasons
  from (
    select sq.id as squad_id,
           least(70, count(distinct lower(k.name)) * 20) + case when sq.status = 'recruiting' then 10 else 20 end as score,
           array['Compétences de l''équipe : ' || string_agg(distinct k.name, ', ')] as reasons
    from squads sq
    cross join lateral (
      select unnest(sq.skills_needed) as name
      union
      select s.name from squad_members sm join user_skills us on us.user_id = sm.user_id join skills s on s.id = us.skill_id
      where sm.squad_id = sq.id and sm.status = 'member'
      union
      select s.name from user_skills us join skills s on s.id = us.skill_id where us.user_id = sq.owner_id
    ) k
    where sq.status in ('recruiting', 'active')
      and lower(k.name) in (select lower(t) from unnest(o.technologies) t)
    group by sq.id
  ) m
  order by m.score desc
  limit 20
  on conflict (opportunity_id, target_type, target_id) do update set score = excluded.score, reasons = excluded.reasons;

  get diagnostics v_n = row_count;
  return (select count(*) from opportunity_matches where opportunity_id = p_opportunity);
end $$;
revoke execute on function public.compute_opportunity_matches from public, anon, authenticated;

-- Alertes : profils et porteurs de Squad au-dessus de 50
create or replace function public.notify_opportunity_matches(p_opportunity uuid)
returns table (user_id uuid, score integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare o opportunities%rowtype;
begin
  select * into o from opportunities where id = p_opportunity;
  return query
  with targets as (
    select m.target_id as uid, m.score from opportunity_matches m
    where m.opportunity_id = p_opportunity and m.target_type = 'user' and not m.notified and m.score >= 50
    union all
    select sq.owner_id, m.score from opportunity_matches m join squads sq on sq.id = m.target_id
    where m.opportunity_id = p_opportunity and m.target_type = 'squad' and not m.notified and m.score >= 50
  ), best as (
    select uid, max(t.score)::int as score from targets t group by uid
  ), sent as (
    insert into notifications (user_id, kind, payload)
    select b.uid, 'opportunity_match',
           jsonb_build_object('opportunity_id', o.id, 'title', o.title, 'organization', o.organization_name, 'score', b.score)
    from best b
    returning notifications.user_id
  )
  select b.uid, b.score from best b;

  update opportunity_matches set notified = true where opportunity_id = p_opportunity and score >= 50;
end $$;
revoke execute on function public.notify_opportunity_matches from public, anon, authenticated;

-- Mes opportunités, triées par score (en mon nom ou au nom d'une de mes Squads)
create or replace function public.my_opportunities()
returns table (opportunity_id uuid, score integer, reasons text[], via_squad text)
language sql stable security definer set search_path = public as $$
  select distinct on (m.opportunity_id) m.opportunity_id, m.score, m.reasons,
         case when m.target_type = 'squad' then sq.name end
  from opportunity_matches m
  join opportunities o on o.id = m.opportunity_id and o.status = 'open'
  left join squads sq on m.target_type = 'squad' and sq.id = m.target_id
  where (m.target_type = 'user' and m.target_id = auth.uid())
     or (m.target_type = 'squad' and (sq.owner_id = auth.uid()
         or exists (select 1 from squad_members sm where sm.squad_id = sq.id and sm.user_id = auth.uid() and sm.status = 'member')))
  order by m.opportunity_id, m.score desc;
$$;

-- Réponse à une opportunité, seul ou au nom d'une Squad dont on est porteur
create or replace function public.respond_opportunity(p_opportunity uuid, p_message text, p_budget bigint, p_squad uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare o opportunities%rowtype; v_id uuid; v_name text;
begin
  select * into o from opportunities where id = p_opportunity;
  if o.status <> 'open' then raise exception 'Cette opportunité est close'; end if;
  if o.publisher_id = auth.uid() then raise exception 'Tu as publié cette opportunité'; end if;
  if p_squad is not null and not exists (select 1 from squads where id = p_squad and owner_id = auth.uid()) then
    raise exception 'Seul le porteur répond au nom d''une Squad';
  end if;
  insert into opportunity_responses (opportunity_id, responder_id, squad_id, message, proposed_budget)
  values (p_opportunity, auth.uid(), p_squad, trim(p_message), p_budget)
  returning id into v_id;
  select coalesce(full_name, username) into v_name from profiles where id = auth.uid();
  if o.publisher_id is not null then
    insert into notifications (user_id, kind, payload)
    values (o.publisher_id, 'opportunity_response', jsonb_build_object('opportunity_id', o.id, 'title', o.title, 'from', v_name));
  end if;
  return v_id;
end $$;

create or replace function public.set_response_status(p_response uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare r opportunity_responses%rowtype; o opportunities%rowtype;
begin
  select * into r from opportunity_responses where id = p_response;
  select * into o from opportunities where id = r.opportunity_id;
  if o.publisher_id is distinct from auth.uid() and not is_moderator() then raise exception 'Réservé à l''organisation'; end if;
  if p_status not in ('shortlisted', 'accepted', 'declined') then raise exception 'Statut invalide'; end if;
  update opportunity_responses set status = p_status where id = p_response;
  insert into notifications (user_id, kind, payload)
  values (r.responder_id, 'opportunity_response_status', jsonb_build_object('opportunity_id', o.id, 'title', o.title, 'status', p_status));
  if p_status = 'accepted' then update opportunities set status = 'closed' where id = o.id; end if;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.opportunities enable row level security;
alter table public.opportunity_matches enable row level security;
alter table public.opportunity_responses enable row level security;
alter table public.radar_sources enable row level security;

create policy "ouvertes ou les miennes" on public.opportunities for select
  using (status <> 'draft' or publisher_id = auth.uid() or public.is_moderator());
create policy "publier" on public.opportunities for insert to authenticated
  with check (publisher_id = auth.uid() and source = 'publiee' and status = 'draft');
create policy "modifier la mienne" on public.opportunities for update
  using (publisher_id = auth.uid() or public.is_moderator());
revoke update on public.opportunities from authenticated, anon;
grant update (title, need, technologies, budget_min, budget_max, deadline, country, city, contact, organization_name, org_type, status)
  on public.opportunities to authenticated;

-- Le détail des correspondances reste privé : chacun voit les siennes (et l'organisation, celles de son opportunité)
create policy "mes correspondances" on public.opportunity_matches for select using (
  (target_type = 'user' and target_id = auth.uid())
  or exists (select 1 from public.opportunities o where o.id = opportunity_id and o.publisher_id = auth.uid())
);

create policy "réponses : auteur et organisation" on public.opportunity_responses for select using (
  responder_id = auth.uid()
  or exists (select 1 from public.opportunities o where o.id = opportunity_id and o.publisher_id = auth.uid())
  or public.is_moderator()
);

create policy "modération" on public.radar_sources for all using (public.is_moderator()) with check (public.is_moderator());
