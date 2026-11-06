-- Espace recruteurs (§11, V2) : abonnement, recherche avancée de profils vérifiés,
-- présélections, prises de contact consenties et vues de profil.
--
-- Principes :
--   * « Vérifié » ne se déclare pas : le statut est calculé à partir de preuves sur la plateforme
--     (GitHub relié, réponses acceptées, Squads menées à terme, primes gagnées, défis, audits, projets).
--   * Le dev garde la main : il peut se rendre invisible aux recruteurs, et aucun recruteur ne peut
--     lui écrire directement. Il reçoit une proposition, qu'il accepte (la conversation s'ouvre) ou décline.
--   * L'abonnement se paie depuis le portefeuille Baobab, pour 30 jours, avec un quota de prises de contact.

insert into public.app_settings (key, value) values
  ('recruiter_price', '25000'),           -- FCFA pour 30 jours
  ('recruiter_contacts_quota', '20'),     -- prises de contact par période d'abonnement
  ('recruiter_contact_ttl_days', '14')    -- une proposition sans réponse expire
on conflict (key) do nothing;

alter table public.transactions drop constraint transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in (
  'topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'commission',
  'clone_payment', 'clone_earning', 'clone_refund', 'clone_pass', 'clone_pass_payout',
  'audit_payment', 'audit_payout', 'audit_refund',
  'infra_usage',
  'recruiter_subscription'
));

-- Préférences du dev vis-à-vis des recruteurs
alter table public.profiles
  add column recruiter_visible boolean not null default true,
  add column open_to text[] not null default '{}'
    check (open_to <@ array['cdi', 'cdd', 'freelance', 'stage', 'mission', 'remote']::text[]);
grant update (recruiter_visible, open_to) on public.profiles to authenticated;

-- ============================================================
-- Tables
-- ============================================================
create table public.recruiter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  company text not null check (char_length(company) between 2 and 80),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  amount integer not null,
  contacts_quota integer not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.recruiter_subscriptions (recruiter_id, ends_at desc);

create table public.recruiter_shortlist (
  recruiter_id uuid references public.profiles (id) on delete cascade,
  dev_id uuid references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (recruiter_id, dev_id)
);

create table public.recruiter_contacts (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  dev_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid not null references public.recruiter_subscriptions (id) on delete cascade,
  company text not null,
  offer_kind text not null check (offer_kind in ('cdi', 'cdd', 'freelance', 'stage', 'mission')),
  title text not null check (char_length(title) between 3 and 120),
  message text not null check (char_length(message) between 20 and 1500),
  budget text check (char_length(budget) <= 80),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  decline_reason text check (char_length(decline_reason) <= 300),
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (recruiter_id <> dev_id)
);
create index on public.recruiter_contacts (dev_id, created_at desc);
create index on public.recruiter_contacts (recruiter_id, created_at desc);
-- Une seule proposition en attente par paire recruteur / dev
create unique index recruiter_contacts_one_pending on public.recruiter_contacts (recruiter_id, dev_id) where status = 'pending';

create table public.recruiter_profile_views (
  id bigserial primary key,
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  dev_id uuid not null references public.profiles (id) on delete cascade,
  viewed_on date not null default current_date,
  unique (recruiter_id, dev_id, viewed_on)
);
create index on public.recruiter_profile_views (dev_id, viewed_on desc);

-- ============================================================
-- Fonctions
-- ============================================================

-- Abonnement actif d'un recruteur (null sinon)
create or replace function public.active_recruiter_subscription(p_user uuid)
returns public.recruiter_subscriptions language sql stable security definer set search_path = public as $$
  select * from recruiter_subscriptions
  where recruiter_id = p_user and now() between starts_at and ends_at
  order by ends_at desc limit 1;
$$;
revoke execute on function public.active_recruiter_subscription from public, anon, authenticated;

create or replace function public.my_recruiter_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sub recruiter_subscriptions;
begin
  if auth.uid() is null then return jsonb_build_object('active', false); end if;
  v_sub := active_recruiter_subscription(auth.uid());
  if v_sub.id is null then
    return jsonb_build_object(
      'active', false,
      'price', (select (value #>> '{}')::int from app_settings where key = 'recruiter_price'),
      'quota', (select (value #>> '{}')::int from app_settings where key = 'recruiter_contacts_quota'),
      'last_company', (select company from recruiter_subscriptions where recruiter_id = auth.uid() order by ends_at desc limit 1)
    );
  end if;
  return jsonb_build_object(
    'active', true,
    'subscription_id', v_sub.id,
    'company', v_sub.company,
    'ends_at', (select max(ends_at) from recruiter_subscriptions where recruiter_id = auth.uid()),
    'quota', v_sub.contacts_quota,
    'used', (select count(*) from recruiter_contacts where subscription_id = v_sub.id),
    'price', (select (value #>> '{}')::int from app_settings where key = 'recruiter_price')
  );
end $$;

-- S'abonner ou prolonger de 30 jours (prolongation à partir de la fin de l'abonnement en cours)
create or replace function public.subscribe_recruiter(p_company text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_price integer := (select (value #>> '{}')::int from app_settings where key = 'recruiter_price');
  v_quota integer := (select (value #>> '{}')::int from app_settings where key = 'recruiter_contacts_quota');
  v_start timestamptz;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if char_length(trim(coalesce(p_company, ''))) < 2 then raise exception 'Indique le nom de ta structure'; end if;
  -- Les prolongations s'enchaînent après la dernière période déjà payée
  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from recruiter_subscriptions where recruiter_id = auth.uid();

  insert into recruiter_subscriptions (recruiter_id, company, starts_at, ends_at, amount, contacts_quota)
  values (auth.uid(), trim(p_company), v_start, v_start + interval '30 days', v_price, v_quota)
  returning id into v_id;
  perform wallet_move(auth.uid(), -v_price, 'recruiter_subscription', 'recruiter_subscription', v_id);
  perform wallet_move(null, v_price, 'recruiter_subscription', 'recruiter_subscription', v_id);
  return v_id;
end $$;

-- Preuves vérifiables d'un dev, calculées à partir de l'activité réelle
create or replace function public.talent_evidence(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with e as (
    select
      (select github_username is not null from profiles where id = p_user) as github,
      (select count(*) from answers where author_id = p_user and is_accepted)::int as accepted_answers,
      (select count(*) from squads s
        where s.status = 'completed'
          and (s.owner_id = p_user or exists (select 1 from squad_members m
                where m.squad_id = s.id and m.user_id = p_user and m.status = 'member')))::int as squads_completed,
      (select count(*) from bounties where winner_id = p_user and status = 'paid')::int as bounties_won,
      (select count(*) from points_log where user_id = p_user and reason = 'challenge_won')::int as challenge_podiums,
      (select count(*) from points_log where user_id = p_user and reason = 'audit_completed')::int as audits,
      (select count(*) from projects where owner_id = p_user)::int as projects,
      (select count(*) from user_badges where user_id = p_user)::int as badges
  )
  select jsonb_build_object(
    'github', github,
    'accepted_answers', accepted_answers,
    'squads_completed', squads_completed,
    'bounties_won', bounties_won,
    'challenge_podiums', challenge_podiums,
    'audits', audits,
    'projects', projects,
    'badges', badges,
    -- Nombre de familles de preuves distinctes
    'proofs', (github::int + (accepted_answers > 0)::int + (squads_completed > 0)::int + (bounties_won > 0)::int
               + (challenge_podiums > 0)::int + (audits > 0)::int + (projects > 0)::int),
    -- Vérifié : GitHub relié et au moins deux autres familles de preuves
    'verified', github and ((accepted_answers > 0)::int + (squads_completed > 0)::int + (bounties_won > 0)::int
               + (challenge_podiums > 0)::int + (audits > 0)::int + (projects > 0)::int) >= 2
  ) from e;
$$;

-- Recherche avancée : réservée aux abonnés, limitée aux devs visibles
create or replace function public.search_talents(
  p_query text default null,
  p_skills text[] default '{}',
  p_country text default null,
  p_city text default null,
  p_min_xp integer default 0,
  p_availability text default null,
  p_open_to text default null,
  p_verified_only boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
) returns table (
  user_id uuid, username text, full_name text, avatar_url text, bio text, city text, country text,
  xp integer, availability text, open_to text[], languages text[], skills text[], matched_skills text[],
  evidence jsonb, score integer, shortlisted boolean, contacted text
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_skills text[] := coalesce((select array_agg(lower(trim(s))) from unnest(p_skills) s where trim(s) <> ''), '{}');
  v_q text := nullif(lower(trim(coalesce(p_query, ''))), '');
begin
  if v_me is null or (active_recruiter_subscription(v_me)).id is null then
    raise exception 'Abonnement recruteur requis';
  end if;

  return query
  with base as (
    select p.*,
      coalesce((select array_agg(s.name order by us.weight desc, s.name) from user_skills us join skills s on s.id = us.skill_id
                where us.user_id = p.id), '{}') as all_skills
    from profiles p
    where p.recruiter_visible
      and p.role = 'developer'
      and p.id <> v_me
      and not exists (select 1 from user_blocks b where b.blocker_id = p.id and b.blocked_id = v_me)
      and (p_country is null or p.country ilike p_country)
      and (p_city is null or p.city ilike p_city)
      and p.xp >= coalesce(p_min_xp, 0)
      and (p_availability is null or p.availability = p_availability)
      and (p_open_to is null or p_open_to = any (p.open_to))
  ), scored as (
    select b.*,
      array(select s from unnest(b.all_skills) s where lower(s) = any (v_skills)) as matched,
      talent_evidence(b.id) as ev
    from base b
    where (v_q is null
           or lower(b.username) like '%' || v_q || '%'
           or lower(coalesce(b.full_name, '')) like '%' || v_q || '%'
           or lower(coalesce(b.bio, '')) like '%' || v_q || '%'
           or exists (select 1 from unnest(b.all_skills) s where lower(s) like '%' || v_q || '%'))
  )
  select sc.id, sc.username, sc.full_name, sc.avatar_url, sc.bio, sc.city, sc.country,
         sc.xp, sc.availability, sc.open_to, sc.languages, sc.all_skills[1:8], sc.matched, sc.ev,
         -- Score : compétences demandées (50), preuves (30), réputation (20)
         (case when cardinality(v_skills) = 0 then 50
               else 50 * cardinality(sc.matched) / cardinality(v_skills) end
          + least((sc.ev ->> 'proofs')::int * 5, 30)
          + least(sc.xp / 250, 20))::int as score,
         exists (select 1 from recruiter_shortlist r where r.recruiter_id = v_me and r.dev_id = sc.id),
         (select c.status from recruiter_contacts c where c.recruiter_id = v_me and c.dev_id = sc.id
          order by c.created_at desc limit 1)
  from scored sc
  where (cardinality(v_skills) = 0 or cardinality(sc.matched) > 0)
    and (not p_verified_only or (sc.ev ->> 'verified')::boolean)
  order by score desc, sc.xp desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- Aperçu public du vivier (sans identités) pour donner envie de s'abonner
create or replace function public.talent_pool_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (select p.id, p.country, p.availability from profiles p
             where p.recruiter_visible and p.role = 'developer')
  select jsonb_build_object(
    'visible', (select count(*) from v),
    'verified', (select count(*) from v where (talent_evidence(v.id) ->> 'verified')::boolean),
    'available', (select count(*) from v where availability = 'available'),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country', country, 'n', n) order by n desc)
                           from (select country, count(*) n from v where country is not null group by country) c), '[]'),
    'top_skills', coalesce((select jsonb_agg(jsonb_build_object('skill', name, 'n', n) order by n desc)
                            from (select s.name, count(*) n from user_skills us join skills s on s.id = us.skill_id
                                  where us.user_id in (select id from v) group by s.name order by count(*) desc limit 10) t), '[]')
  );
$$;

-- Vue d'une fiche par un recruteur abonné : journalisée (une fois par jour et par dev)
create or replace function public.recruiter_view_profile(p_dev uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or (active_recruiter_subscription(v_me)).id is null then
    raise exception 'Abonnement recruteur requis';
  end if;
  if not exists (select 1 from profiles where id = p_dev and recruiter_visible) then
    raise exception 'Ce profil n''est pas visible des recruteurs';
  end if;
  if p_dev <> v_me then
    insert into recruiter_profile_views (recruiter_id, dev_id) values (v_me, p_dev) on conflict do nothing;
  end if;
  return talent_evidence(p_dev);
end $$;

-- Ce que le dev voit : combien de recruteurs l'ont consulté sur 30 jours
create or replace function public.my_recruiter_views()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'views_30d', (select count(distinct recruiter_id) from recruiter_profile_views
                  where dev_id = auth.uid() and viewed_on > current_date - 30),
    'companies', coalesce((
      select jsonb_agg(distinct s.company) from recruiter_profile_views v
      join lateral (select company from recruiter_subscriptions rs where rs.recruiter_id = v.recruiter_id
                    order by ends_at desc limit 1) s on true
      where v.dev_id = auth.uid() and v.viewed_on > current_date - 30), '[]')
  );
$$;

-- Présélection (note privée du recruteur)
create or replace function public.toggle_shortlist(p_dev uuid, p_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or (active_recruiter_subscription(v_me)).id is null then
    raise exception 'Abonnement recruteur requis';
  end if;
  if exists (select 1 from recruiter_shortlist where recruiter_id = v_me and dev_id = p_dev) and p_note is null then
    delete from recruiter_shortlist where recruiter_id = v_me and dev_id = p_dev;
    return false;
  end if;
  insert into recruiter_shortlist (recruiter_id, dev_id, note) values (v_me, p_dev, nullif(trim(p_note), ''))
  on conflict (recruiter_id, dev_id) do update set note = excluded.note;
  return true;
end $$;

-- Proposition de contact : le dev décide d'ouvrir ou non la conversation
create or replace function public.send_recruiter_contact(
  p_dev uuid, p_offer_kind text, p_title text, p_message text, p_budget text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_sub recruiter_subscriptions;
  v_used integer;
  v_id uuid;
begin
  if v_me is null then raise exception 'Connexion requise'; end if;
  v_sub := active_recruiter_subscription(v_me);
  if v_sub.id is null then raise exception 'Abonnement recruteur requis'; end if;
  if p_dev = v_me then raise exception 'Impossible de se contacter soi-même'; end if;
  if not exists (select 1 from profiles where id = p_dev and recruiter_visible) then
    raise exception 'Ce profil n''est pas visible des recruteurs';
  end if;
  if exists (select 1 from user_blocks where blocker_id = p_dev and blocked_id = v_me) then
    raise exception 'Ce dev ne reçoit pas tes propositions';
  end if;
  -- Après un refus, on laisse le dev tranquille 30 jours
  if exists (select 1 from recruiter_contacts where recruiter_id = v_me and dev_id = p_dev
             and status = 'declined' and responded_at > now() - interval '30 days') then
    raise exception 'Ce dev a décliné ta dernière proposition il y a moins de 30 jours';
  end if;
  if exists (select 1 from recruiter_contacts where recruiter_id = v_me and dev_id = p_dev and status = 'pending') then
    raise exception 'Une proposition est déjà en attente auprès de ce dev';
  end if;
  select count(*) into v_used from recruiter_contacts where subscription_id = v_sub.id;
  if v_used >= v_sub.contacts_quota then
    raise exception 'Quota de prises de contact atteint (%) pour cette période', v_sub.contacts_quota;
  end if;

  insert into recruiter_contacts (recruiter_id, dev_id, subscription_id, company, offer_kind, title, message, budget)
  values (v_me, p_dev, v_sub.id, v_sub.company, p_offer_kind, trim(p_title), trim(p_message), nullif(trim(p_budget), ''))
  returning id into v_id;

  insert into notifications (user_id, kind, payload)
  values (p_dev, 'recruiter_contact',
          jsonb_build_object('contact_id', v_id, 'company', v_sub.company, 'title', trim(p_title), 'offer_kind', p_offer_kind));
  return v_id;
end $$;

-- Réponse du dev : accepter ouvre la conversation privée avec le message du recruteur en tête
create or replace function public.respond_recruiter_contact(p_contact uuid, p_accept boolean, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c recruiter_contacts;
  v_key text;
  v_conv uuid;
begin
  select * into c from recruiter_contacts where id = p_contact for update;
  if c.id is null or c.dev_id <> auth.uid() then raise exception 'Proposition introuvable'; end if;
  if c.status <> 'pending' then raise exception 'Proposition déjà traitée'; end if;

  if not p_accept then
    update recruiter_contacts set status = 'declined', responded_at = now(), decline_reason = nullif(trim(p_reason), '')
    where id = p_contact;
    insert into notifications (user_id, kind, payload)
    values (c.recruiter_id, 'recruiter_contact_answer', jsonb_build_object('contact_id', c.id, 'accepted', false, 'title', c.title,
            'dev', (select username from profiles where id = c.dev_id)));
    return null;
  end if;

  v_key := least(c.dev_id::text, c.recruiter_id::text) || ':' || greatest(c.dev_id::text, c.recruiter_id::text);
  select id into v_conv from conversations where direct_key = v_key;
  if v_conv is null then
    insert into conversations (kind, direct_key, created_by) values ('direct', v_key, c.dev_id) returning id into v_conv;
    insert into conversation_members (conversation_id, user_id, role)
    values (v_conv, c.dev_id, 'owner'), (v_conv, c.recruiter_id, 'member');
  end if;
  insert into messages (conversation_id, author_id, body)
  values (v_conv, c.recruiter_id,
          left(format(E'**%s · %s** (%s)%s\n\n%s', c.company, c.title, c.offer_kind,
                      coalesce(' · ' || c.budget, ''), c.message), 4000));

  update recruiter_contacts set status = 'accepted', responded_at = now(), conversation_id = v_conv where id = p_contact;
  insert into notifications (user_id, kind, payload)
  values (c.recruiter_id, 'recruiter_contact_answer', jsonb_build_object('contact_id', c.id, 'accepted', true, 'title', c.title,
          'conversation_id', v_conv, 'dev', (select username from profiles where id = c.dev_id)));
  return v_conv;
end $$;

-- Tâche quotidienne : les propositions sans réponse expirent
create or replace function public.expire_recruiter_contacts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ttl integer := (select (value #>> '{}')::int from app_settings where key = 'recruiter_contact_ttl_days');
  v_n integer;
begin
  update recruiter_contacts set status = 'expired', responded_at = now()
  where status = 'pending' and created_at < now() - make_interval(days => v_ttl);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.expire_recruiter_contacts from public, anon, authenticated;

create or replace function public.cron_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev date := (date_trunc('month', now()) - interval '1 month')::date;
begin
  return jsonb_build_object(
    'expired_bounties', expire_bounties(),
    'clone_pass_payouts', distribute_clone_passes(v_prev),
    'refunded_audits', expire_audits(),
    'infra', meter_infra(),
    'expired_recruiter_contacts', expire_recruiter_contacts()
  );
end $$;
revoke execute on function public.cron_daily from public, anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.recruiter_subscriptions enable row level security;
alter table public.recruiter_shortlist enable row level security;
alter table public.recruiter_contacts enable row level security;
alter table public.recruiter_profile_views enable row level security;

-- Tout passe par les fonctions : lecture seule, chacun ne voit que ce qui le concerne
create policy "mes abonnements" on public.recruiter_subscriptions for select
  using (recruiter_id = auth.uid() or public.is_moderator());
create policy "ma présélection" on public.recruiter_shortlist for select using (recruiter_id = auth.uid());
create policy "propositions me concernant" on public.recruiter_contacts for select
  using (recruiter_id = auth.uid() or dev_id = auth.uid() or public.is_moderator());
-- Le dev ne voit pas qui l'a consulté ligne par ligne : seulement l'agrégat via my_recruiter_views
create policy "mes consultations" on public.recruiter_profile_views for select using (recruiter_id = auth.uid());

revoke insert, update, delete on public.recruiter_subscriptions, public.recruiter_shortlist,
  public.recruiter_contacts, public.recruiter_profile_views from anon, authenticated;
