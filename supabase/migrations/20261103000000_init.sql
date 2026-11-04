-- Baobab Dev : schéma initial du MVP (cahier des charges §10.2)
-- Montants en FCFA entiers (bigint). XP en entiers.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Paramètres
-- ============================================================
create table public.app_settings (
  key text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value) values
  ('payments_mode', '"test"'),            -- 'test' au MVP, 'live' en V1
  ('bounty_commission_pct', '10'),
  ('bounty_min_amount', '2000'),
  ('vote_xp_daily_cap', '200');

-- ============================================================
-- Profils et compétences
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text,
  avatar_url text,
  github_username text unique,
  bio text,
  country text,
  city text,
  languages text[] not null default '{fr}',
  timezone text default 'Africa/Porto-Novo',
  availability text check (availability in ('available', 'limited', 'busy')) default 'available',
  goals text[] not null default '{}', -- apprendre, aider, collaborer, missions
  role text not null default 'developer'
    check (role in ('developer', 'organization', 'moderator', 'admin')),
  xp integer not null default 0,
  pinned_badges text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id serial primary key,
  name text not null unique
);

create table public.user_skills (
  user_id uuid references public.profiles (id) on delete cascade,
  skill_id integer references public.skills (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'github')),
  weight integer not null default 1, -- ex. nombre de dépôts utilisant la techno
  primary key (user_id, skill_id)
);

-- Niveaux (§5.7) : Graine 0 → Légende Baobab 10 000
create or replace function public.level_for_xp(p_xp integer)
returns table (level integer, name text, floor_xp integer, next_xp integer)
language sql immutable as $$
  with l(level, name, floor_xp) as (values
    (1, 'Graine', 0), (2, 'Pousse', 100), (3, 'Jeune Baobab', 300),
    (4, 'Bâtisseur', 800), (5, 'Expert', 2000), (6, 'Griot du Code', 5000),
    (7, 'Légende Baobab', 10000)
  )
  select cur.level, cur.name, cur.floor_xp,
         (select min(n.floor_xp) from l n where n.level = cur.level + 1)
  from l cur
  where cur.floor_xp <= greatest(p_xp, 0)
  order by cur.level desc
  limit 1;
$$;

-- ============================================================
-- Gamification : journal de points, badges
-- ============================================================
create table public.points_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null, -- answer_upvoted, answer_accepted, griot_citation, ...
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index on public.points_log (user_id, created_at desc);

create table public.badges (
  code text primary key,           -- ex. chasseur_primes_bronze
  name text not null,
  category text not null,          -- entraide, construction, collaboration, economie, ia, panafricain, assiduite, techno
  tier text not null check (tier in ('bronze', 'argent', 'or')),
  description text not null
);

create table public.user_badges (
  user_id uuid references public.profiles (id) on delete cascade,
  badge_code text references public.badges (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

create or replace function public.add_points(
  p_user uuid, p_amount integer, p_reason text, p_ref_type text default null, p_ref_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount = 0 then return; end if;
  insert into points_log (user_id, amount, reason, ref_type, ref_id)
  values (p_user, p_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set xp = greatest(xp + p_amount, 0), updated_at = now() where id = p_user;
end $$;

create or replace function public.award_badge(p_user uuid, p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into user_badges (user_id, badge_code) values (p_user, p_code)
  on conflict do nothing;
  if found then
    insert into notifications (user_id, kind, payload)
    values (p_user, 'badge_unlocked', jsonb_build_object('badge', p_code));
  end if;
  return found;
end $$;

-- ============================================================
-- Notifications et modération
-- ============================================================
create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.reports (
  id bigserial primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('question', 'answer', 'project', 'comment', 'profile', 'griot_query')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('moderator', 'admin'));
$$;

-- ============================================================
-- Questions-réponses (§5.3)
-- ============================================================
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 10 and 200),
  body text not null,
  tags text[] not null default '{}',
  language text not null default 'fr',
  accepted_answer_id uuid,
  answers_count integer not null default 0,
  bounty_id uuid,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.questions using gin (tags);
create index on public.questions (created_at desc);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  score integer not null default 0,
  is_accepted boolean not null default false,
  griot_citations_count integer not null default 0,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.answers (question_id);
create index on public.answers using hnsw (embedding extensions.vector_cosine_ops);

alter table public.questions
  add constraint questions_accepted_answer_fk
  foreign key (accepted_answer_id) references public.answers (id) on delete set null;

create table public.votes (
  user_id uuid references public.profiles (id) on delete cascade,
  answer_id uuid references public.answers (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, answer_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('question', 'answer', 'project')),
  target_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.comments (target_type, target_id);

create or replace function public.on_answer_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update questions set answers_count = answers_count + 1 where id = new.question_id;
    return new;
  else
    update questions set answers_count = answers_count - 1 where id = old.question_id;
    return old;
  end if;
end $$;
create trigger answers_count after insert or delete on public.answers
  for each row execute function public.on_answer_change();

-- Votes : +10 XP par vote positif, avec anti-triche (§5.7)
create or replace function public.on_vote_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_answer answers%rowtype;
  v_voter_created timestamptz;
  v_delta integer := coalesce(new.value, 0) - coalesce(old.value, 0);
  v_xp integer;
  v_today integer;
  v_cap integer := (select value::int from app_settings where key = 'vote_xp_daily_cap');
begin
  select * into v_answer from answers where id = coalesce(new.answer_id, old.answer_id);
  if v_answer.author_id = coalesce(new.user_id, old.user_id) then
    raise exception 'Impossible de voter pour sa propre réponse';
  end if;

  update answers set score = score + v_delta where id = v_answer.id;

  -- XP seulement à la création d'un vote positif
  if tg_op = 'INSERT' and new.value = 1 then
    select created_at into v_voter_created from profiles where id = new.user_id;
    v_xp := case when v_voter_created > now() - interval '7 days' then 5 else 10 end;

    select coalesce(sum(amount), 0) into v_today from points_log
    where user_id = v_answer.author_id and reason = 'answer_upvoted'
      and created_at > date_trunc('day', now());

    v_xp := least(v_xp, greatest(v_cap - v_today, 0));
    perform add_points(v_answer.author_id, v_xp, 'answer_upvoted', 'answer', v_answer.id);
  end if;
  return coalesce(new, old);
end $$;
create trigger votes_change after insert or update or delete on public.votes
  for each row execute function public.on_vote_change();

-- Validation de la meilleure réponse par l'auteur de la question : +25 XP
create or replace function public.accept_answer(p_answer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_answer answers%rowtype;
  v_question questions%rowtype;
begin
  select * into v_answer from answers where id = p_answer_id;
  select * into v_question from questions where id = v_answer.question_id;
  if v_question.author_id is distinct from auth.uid() then
    raise exception 'Seul l''auteur de la question peut valider une réponse';
  end if;
  if v_question.accepted_answer_id is not null then
    raise exception 'Une réponse est déjà validée';
  end if;

  update answers set is_accepted = true where id = p_answer_id;
  update questions set accepted_answer_id = p_answer_id, updated_at = now() where id = v_question.id;
  if v_answer.author_id <> v_question.author_id then
    perform add_points(v_answer.author_id, 25, 'answer_accepted', 'answer', p_answer_id);
    perform award_badge(v_answer.author_id, 'sage_village_bronze');
  end if;
end $$;

-- ============================================================
-- Le Griot (§6.1)
-- ============================================================
create table public.griot_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  channel text not null default 'app' check (channel in ('app', 'whatsapp')),
  question text not null,
  answer text,
  status text not null default 'pending'
    check (status in ('pending', 'answered', 'no_source', 'escalated')),
  escalated_question_id uuid references public.questions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.griot_citations (
  id bigserial primary key,
  query_id uuid not null references public.griot_queries (id) on delete cascade,
  answer_id uuid not null references public.answers (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (query_id, answer_id)
);

create or replace function public.on_griot_citation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update answers set griot_citations_count = griot_citations_count + 1 where id = new.answer_id;
  perform add_points(new.author_id, 5, 'griot_citation', 'answer', new.answer_id);
  insert into notifications (user_id, kind, payload)
  values (new.author_id, 'griot_citation', jsonb_build_object('answer_id', new.answer_id, 'query_id', new.query_id));

  select count(*) into v_count from griot_citations where author_id = new.author_id;
  if v_count >= 10 then perform award_badge(new.author_id, 'voix_griot_bronze'); end if;
  if v_count >= 100 then perform award_badge(new.author_id, 'voix_griot_argent'); end if;
  if v_count >= 1000 then perform award_badge(new.author_id, 'voix_griot_or'); end if;
  return new;
end $$;
create trigger griot_citation_points after insert on public.griot_citations
  for each row execute function public.on_griot_citation();

-- Recherche sémantique : uniquement des réponses validées ou bien notées
create or replace function public.match_answers(
  query_embedding extensions.vector(1024), match_count integer default 5, min_similarity float default 0.75
) returns table (
  answer_id uuid, question_id uuid, question_title text, body text,
  author_id uuid, author_username text, author_city text, author_country text, similarity float
)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, q.id, q.title, a.body, p.id, p.username, p.city, p.country,
         1 - (a.embedding <=> query_embedding) as similarity
  from answers a
  join questions q on q.id = a.question_id
  join profiles p on p.id = a.author_id
  where a.embedding is not null
    and (a.is_accepted or a.score >= 2)
    and 1 - (a.embedding <=> query_embedding) >= min_similarity
  order by a.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Showroom (§5.4)
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text not null,
  screenshots text[] not null default '{}',
  demo_url text,
  repo_url text,
  stack text[] not null default '{}',
  status text not null default 'building' check (status in ('idea', 'building', 'launched', 'paused', 'abandoned')),
  looking_for_contributors boolean not null default false,
  squad_id uuid,
  likes_count integer not null default 0,
  project_of_week_at date,
  last_commit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_likes (
  project_id uuid references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create or replace function public.on_project_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform add_points(new.owner_id, 15, 'project_published', 'project', new.id);
  perform award_badge(new.owner_id, 'batisseur_bronze');
  return new;
end $$;
create trigger project_points after insert on public.projects
  for each row execute function public.on_project_insert();

create or replace function public.on_project_like()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update projects set likes_count = likes_count + case when tg_op = 'INSERT' then 1 else -1 end
  where id = coalesce(new.project_id, old.project_id);
  return coalesce(new, old);
end $$;
create trigger project_likes_count after insert or delete on public.project_likes
  for each row execute function public.on_project_like();

-- ============================================================
-- Squads (§5.5)
-- ============================================================
create table public.squads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  description text not null,
  roles_needed text[] not null default '{}',
  skills_needed text[] not null default '{}',
  duration_weeks integer check (duration_weeks > 0),
  commitment text, -- ex. "5 h / semaine"
  status text not null default 'recruiting' check (status in ('recruiting', 'active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.projects
  add constraint projects_squad_fk foreign key (squad_id) references public.squads (id) on delete set null;

create table public.squad_members (
  squad_id uuid references public.squads (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  role text,
  status text not null default 'applied' check (status in ('applied', 'invited', 'member', 'left', 'rejected')),
  rating_received numeric(2, 1),
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee_id uuid references public.profiles (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.squad_messages (
  id bigserial primary key,
  squad_id uuid not null references public.squads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_squad_member(p_squad uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from squad_members where squad_id = p_squad and user_id = auth.uid() and status = 'member')
      or exists (select 1 from squads where id = p_squad and owner_id = auth.uid());
$$;

-- Squad terminée : +60 XP à chaque membre ; abandon : -20
create or replace function public.on_squad_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
    for m in select user_id from squad_members where squad_id = new.id and status = 'member'
             union select new.owner_id loop
      perform add_points(m.user_id, 60, 'squad_completed', 'squad', new.id);
      perform award_badge(m.user_id, 'esprit_equipe_bronze');
    end loop;
  end if;
  return new;
end $$;
create trigger squad_status before update of status on public.squads
  for each row execute function public.on_squad_status();

create or replace function public.on_squad_member_left()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'left' and old.status = 'member'
     and (select status from squads where id = new.squad_id) = 'active' then
    perform add_points(new.user_id, -20, 'squad_abandoned', 'squad', new.squad_id);
  end if;
  return new;
end $$;
create trigger squad_member_left after update of status on public.squad_members
  for each row execute function public.on_squad_member_left();

-- ============================================================
-- Portefeuille et journal infalsifiable (§8.3, §9)
-- ============================================================
create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Chaque ligne est chaînée à la précédente par un hash SHA-256
create table public.transactions (
  id bigserial primary key,
  user_id uuid references public.profiles (id) on delete set null, -- null = plateforme
  amount bigint not null, -- signé : + crédit, - débit
  kind text not null check (kind in (
    'topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'commission'
  )),
  ref_type text,
  ref_id uuid,
  is_test boolean not null default true,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now()
);
create index on public.transactions (user_id, created_at desc);

create or replace function public.chain_transaction()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  perform pg_advisory_xact_lock(hashtext('transactions_chain'));
  select hash into new.prev_hash from transactions order by id desc limit 1;
  new.hash := encode(digest(
    concat_ws('|', coalesce(new.prev_hash, 'genesis'), new.id, new.user_id, new.amount,
              new.kind, new.ref_type, new.ref_id, new.is_test, new.created_at),
    'sha256'), 'hex');
  return new;
end $$;
create trigger transactions_chain before insert on public.transactions
  for each row execute function public.chain_transaction();

create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Le journal des transactions est en ajout seul';
end $$;
create trigger transactions_append_only before update or delete on public.transactions
  for each row execute function public.forbid_mutation();

create or replace function public.wallet_move(
  p_user uuid, p_amount bigint, p_kind text, p_ref_type text, p_ref_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare v_test boolean := (select value = '"test"' from app_settings where key = 'payments_mode');
begin
  if p_user is not null then
    update wallets set balance = balance + p_amount, updated_at = now() where user_id = p_user;
    if not found then raise exception 'Portefeuille introuvable'; end if;
  end if;
  insert into transactions (user_id, amount, kind, ref_type, ref_id, is_test)
  values (p_user, p_amount, p_kind, p_ref_type, p_ref_id, v_test);
exception when check_violation then
  raise exception 'Solde insuffisant';
end $$;
revoke execute on function public.wallet_move from public, anon, authenticated;

-- Recharge fictive, disponible uniquement en mode test (démo du hackathon)
create or replace function public.test_topup(p_amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_balance bigint;
begin
  if (select value <> '"test"' from app_settings where key = 'payments_mode') then
    raise exception 'Recharge de test désactivée en mode réel';
  end if;
  if p_amount <= 0 or p_amount > 100000 then
    raise exception 'Montant de test entre 1 et 100 000 FCFA';
  end if;
  perform wallet_move(auth.uid(), p_amount, 'topup', null, null);
  select balance into v_balance from wallets where user_id = auth.uid();
  return v_balance;
end $$;

-- ============================================================
-- Micro-Bourse de code (§8.1)
-- ============================================================
create table public.bounties (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  description text not null,
  repo_url text not null,
  acceptance_criteria text not null,
  tests_path text, -- fichier ou dossier des tests d'acceptation, verrouillé
  question_id uuid references public.questions (id) on delete set null,
  deadline timestamptz not null,
  status text not null default 'open'
    check (status in ('open', 'reserved', 'in_review', 'paid', 'expired', 'refunded', 'disputed')),
  total_amount bigint not null default 0,
  reserved_by uuid references public.profiles (id),
  reserved_until timestamptz,
  winner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.questions
  add constraint questions_bounty_fk foreign key (bounty_id) references public.bounties (id) on delete set null;

create table public.escrows (
  bounty_id uuid primary key references public.bounties (id) on delete restrict,
  amount bigint not null default 0 check (amount >= 0),
  status text not null default 'held' check (status in ('held', 'released', 'refunded')),
  updated_at timestamptz not null default now()
);

create table public.bounty_contributions (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table public.bounty_submissions (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pr_url text not null,
  pr_number integer,
  tests_status text not null default 'pending' check (tests_status in ('pending', 'passed', 'failed')),
  tests_modified boolean not null default false, -- une PR ne peut pas modifier les tests
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null,
  arbiters uuid[] not null default '{}', -- 3 seniors tirés au sort
  decision text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace function public.create_bounty(
  p_title text, p_description text, p_repo_url text, p_acceptance_criteria text,
  p_deadline timestamptz, p_amount bigint, p_tests_path text default null, p_question_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_min bigint := (select value::bigint from app_settings where key = 'bounty_min_amount');
begin
  if p_amount < v_min then raise exception 'Prime minimale : % FCFA', v_min; end if;
  if p_deadline <= now() then raise exception 'La date limite doit être dans le futur'; end if;

  insert into bounties (creator_id, title, description, repo_url, acceptance_criteria,
                        tests_path, question_id, deadline, total_amount)
  values (auth.uid(), p_title, p_description, p_repo_url, p_acceptance_criteria,
          p_tests_path, p_question_id, p_deadline, p_amount)
  returning id into v_id;

  insert into escrows (bounty_id, amount) values (v_id, p_amount);
  insert into bounty_contributions (bounty_id, user_id, amount) values (v_id, auth.uid(), p_amount);
  perform wallet_move(auth.uid(), -p_amount, 'escrow_hold', 'bounty', v_id);

  if p_question_id is not null then
    update questions set bounty_id = v_id where id = p_question_id and author_id = auth.uid();
  end if;
  return v_id;
end $$;

-- Abondement par d'autres devs : badge « Mécène du code »
create or replace function public.contribute_bounty(p_bounty_id uuid, p_amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_total bigint;
begin
  if p_amount <= 0 then raise exception 'Montant invalide'; end if;
  perform 1 from bounties where id = p_bounty_id and status in ('open', 'reserved') for update;
  if not found then raise exception 'Ticket fermé'; end if;

  insert into bounty_contributions (bounty_id, user_id, amount) values (p_bounty_id, auth.uid(), p_amount);
  update escrows set amount = amount + p_amount, updated_at = now() where bounty_id = p_bounty_id;
  update bounties set total_amount = total_amount + p_amount where id = p_bounty_id
    returning total_amount into v_total;
  perform wallet_move(auth.uid(), -p_amount, 'escrow_hold', 'bounty', p_bounty_id);

  if (select creator_id from bounties where id = p_bounty_id) <> auth.uid() then
    perform award_badge(auth.uid(), 'mecene_code_bronze');
  end if;
  return v_total;
end $$;

-- Réservation 48 h pour éviter le travail en double
create or replace function public.reserve_bounty(p_bounty_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v bounties%rowtype;
begin
  select * into v from bounties where id = p_bounty_id for update;
  if v.creator_id = auth.uid() then raise exception 'Le créateur ne peut pas résoudre son propre ticket'; end if;
  if v.status = 'reserved' and v.reserved_until > now() and v.reserved_by <> auth.uid() then
    raise exception 'Ticket déjà réservé jusqu''au %', v.reserved_until;
  end if;
  if v.status not in ('open', 'reserved') then raise exception 'Ticket fermé'; end if;
  update bounties set status = 'reserved', reserved_by = auth.uid(), reserved_until = now() + interval '48 hours'
  where id = p_bounty_id;
end $$;

create or replace function public.submit_bounty(p_bounty_id uuid, p_pr_url text, p_pr_number integer default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v bounties%rowtype; v_id uuid;
begin
  select * into v from bounties where id = p_bounty_id;
  if v.creator_id = auth.uid() then raise exception 'Le créateur ne peut pas résoudre son propre ticket'; end if;
  if v.status not in ('open', 'reserved', 'in_review') then raise exception 'Ticket fermé'; end if;
  if v.status = 'reserved' and v.reserved_until > now() and v.reserved_by <> auth.uid() then
    raise exception 'Ticket réservé par un autre dev';
  end if;
  insert into bounty_submissions (bounty_id, user_id, pr_url, pr_number)
  values (p_bounty_id, auth.uid(), p_pr_url, p_pr_number) returning id into v_id;
  update bounties set status = 'in_review' where id = p_bounty_id;
  return v_id;
end $$;

-- Résultat des tests : appelé uniquement par le webhook GitHub (service_role)
create or replace function public.set_submission_tests(p_submission_id uuid, p_passed boolean, p_tests_modified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bounty_submissions
  set tests_status = case when p_passed and not p_tests_modified then 'passed' else 'failed' end,
      tests_modified = p_tests_modified
  where id = p_submission_id;
end $$;
revoke execute on function public.set_submission_tests from public, anon, authenticated;

-- Libération : tests passés + fusion par le créateur → prime au résolveur, 10 % de commission
create or replace function public.release_bounty(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s bounty_submissions%rowtype;
  b bounties%rowtype;
  v_amount bigint;
  v_fee bigint;
  v_pct integer := (select value::int from app_settings where key = 'bounty_commission_pct');
begin
  select * into s from bounty_submissions where id = p_submission_id;
  select * into b from bounties where id = s.bounty_id for update;

  if b.creator_id is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Seul le créateur du ticket peut fusionner';
  end if;
  if s.tests_status <> 'passed' then raise exception 'Les tests d''acceptation ne passent pas'; end if;
  if b.status in ('paid', 'refunded', 'expired') then raise exception 'Ticket déjà clôturé'; end if;

  select amount into v_amount from escrows where bounty_id = b.id and status = 'held' for update;
  v_fee := v_amount * v_pct / 100;

  update escrows set amount = 0, status = 'released', updated_at = now() where bounty_id = b.id;
  perform wallet_move(s.user_id, v_amount - v_fee, 'escrow_release', 'bounty', b.id);
  perform wallet_move(null, v_fee, 'commission', 'bounty', b.id);

  update bounty_submissions set status = 'accepted' where id = s.id;
  update bounty_submissions set status = 'rejected' where bounty_id = b.id and id <> s.id and status = 'submitted';
  update bounties set status = 'paid', winner_id = s.user_id, paid_at = now() where id = b.id;

  -- +40 à +150 XP selon la prime (§5.7)
  perform add_points(s.user_id, least(150, 40 + (v_amount / 1000)::int * 2), 'bounty_resolved', 'bounty', b.id);
  perform award_badge(s.user_id, 'chasseur_primes_bronze');
  insert into notifications (user_id, kind, payload)
  values (s.user_id, 'bounty_paid', jsonb_build_object('bounty_id', b.id, 'amount', v_amount - v_fee));
end $$;

-- ============================================================
-- Pair-Debugging (§7.5) : journal des événements pour la relecture
-- ============================================================
create table public.debug_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  share_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  bounty_id uuid references public.bounties (id) on delete set null,
  status text not null default 'live' check (status in ('live', 'ended')),
  bytes_sent bigint not null default 0,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.debug_participants (
  session_id uuid references public.debug_sessions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  can_write boolean not null default false, -- « Prendre la main » accordé par l'hôte
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table public.debug_events (
  id bigserial primary key,
  session_id uuid not null references public.debug_sessions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('diff', 'cursor', 'terminal', 'chat', 'control')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.debug_events (session_id, id);

create or replace function public.in_debug_session(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from debug_sessions where id = p_session and host_id = auth.uid())
      or exists (select 1 from debug_participants where session_id = p_session and user_id = auth.uid());
$$;

-- ============================================================
-- Création du profil à l'inscription (GitHub, Google ou téléphone)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_github text := case when new.raw_app_meta_data ->> 'provider' = 'github' then v_meta ->> 'user_name' end;
  v_base text := lower(regexp_replace(coalesce(v_github, v_meta ->> 'user_name', split_part(new.email, '@', 1), 'dev'), '[^a-zA-Z0-9_]', '', 'g'));
  v_username text := nullif(v_base, '');
begin
  if v_username is null or exists (select 1 from profiles where username = v_username) then
    v_username := coalesce(nullif(v_base, ''), 'dev') || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  insert into profiles (id, username, full_name, avatar_url, github_username)
  values (new.id, v_username, coalesce(v_meta ->> 'full_name', v_meta ->> 'name'), v_meta ->> 'avatar_url', v_github);
  insert into wallets (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Sécurité : RLS
-- ============================================================
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;
alter table public.points_log enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.griot_queries enable row level security;
alter table public.griot_citations enable row level security;
alter table public.projects enable row level security;
alter table public.project_likes enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.tasks enable row level security;
alter table public.squad_messages enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.bounties enable row level security;
alter table public.escrows enable row level security;
alter table public.bounty_contributions enable row level security;
alter table public.bounty_submissions enable row level security;
alter table public.disputes enable row level security;
alter table public.debug_sessions enable row level security;
alter table public.debug_participants enable row level security;
alter table public.debug_events enable row level security;

-- Lecture publique (visiteurs compris)
create policy "lecture publique" on public.app_settings for select using (true);
create policy "lecture publique" on public.profiles for select using (true);
create policy "lecture publique" on public.skills for select using (true);
create policy "lecture publique" on public.user_skills for select using (true);
create policy "lecture publique" on public.points_log for select using (true);
create policy "lecture publique" on public.badges for select using (true);
create policy "lecture publique" on public.user_badges for select using (true);
create policy "lecture publique" on public.questions for select using (true);
create policy "lecture publique" on public.answers for select using (true);
create policy "lecture publique" on public.votes for select using (true);
create policy "lecture publique" on public.comments for select using (true);
create policy "lecture publique" on public.griot_citations for select using (true);
create policy "lecture publique" on public.projects for select using (true);
create policy "lecture publique" on public.project_likes for select using (true);
create policy "lecture publique" on public.squads for select using (true);
create policy "lecture publique" on public.squad_members for select using (true);
create policy "lecture publique" on public.bounties for select using (true);
create policy "lecture publique" on public.escrows for select using (true); -- prime visible de tous
create policy "lecture publique" on public.bounty_contributions for select using (true);
create policy "lecture publique" on public.bounty_submissions for select using (true);

-- Profil : chacun modifie le sien, sans toucher à son XP ni à son rôle
create policy "modifier son profil" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (username, full_name, avatar_url, bio, country, city, languages, timezone,
              availability, goals, pinned_badges, updated_at) on public.profiles to authenticated;

create policy "gérer ses compétences" on public.user_skills for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ajouter une compétence" on public.skills for insert to authenticated with check (true);

-- Contenus communautaires : création par soi, modification par l'auteur ou un modérateur
create policy "créer" on public.questions for insert to authenticated with check (author_id = auth.uid());
create policy "modifier" on public.questions for update using (author_id = auth.uid() or public.is_moderator());
create policy "supprimer" on public.questions for delete using (author_id = auth.uid() or public.is_moderator());
revoke update on public.questions from authenticated, anon;
grant update (title, body, tags, language, updated_at) on public.questions to authenticated;

create policy "créer" on public.answers for insert to authenticated with check (author_id = auth.uid());
create policy "modifier" on public.answers for update using (author_id = auth.uid() or public.is_moderator());
create policy "supprimer" on public.answers for delete using (author_id = auth.uid() or public.is_moderator());
revoke update on public.answers from authenticated, anon;
grant update (body, updated_at) on public.answers to authenticated;

create policy "voter" on public.votes for insert to authenticated with check (user_id = auth.uid());
create policy "changer son vote" on public.votes for update using (user_id = auth.uid());
create policy "retirer son vote" on public.votes for delete using (user_id = auth.uid());

create policy "commenter" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "supprimer" on public.comments for delete using (author_id = auth.uid() or public.is_moderator());

create policy "créer" on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy "modifier" on public.projects for update using (owner_id = auth.uid() or public.is_moderator());
create policy "supprimer" on public.projects for delete using (owner_id = auth.uid() or public.is_moderator());
revoke update on public.projects from authenticated, anon;
grant update (name, slug, description, screenshots, demo_url, repo_url, stack, status,
              looking_for_contributors, squad_id, updated_at) on public.projects to authenticated;

create policy "aimer" on public.project_likes for insert to authenticated with check (user_id = auth.uid());
create policy "ne plus aimer" on public.project_likes for delete using (user_id = auth.uid());

create policy "créer" on public.squads for insert to authenticated with check (owner_id = auth.uid());
create policy "modifier" on public.squads for update using (owner_id = auth.uid());
create policy "postuler" on public.squad_members for insert to authenticated
  with check (
    (user_id = auth.uid() and status = 'applied')
    or (status = 'invited' and exists (select 1 from public.squads s where s.id = squad_id and s.owner_id = auth.uid()))
  );
create policy "gérer les membres" on public.squad_members for update
  using (user_id = auth.uid() or exists (select 1 from public.squads s where s.id = squad_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.squads s where s.id = squad_id and s.owner_id = auth.uid())
    or (user_id = auth.uid() and status = 'left')
  );

create or replace function public.accept_squad_invite(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update squad_members set status = 'member', joined_at = now()
  where squad_id = p_squad_id and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'Aucune invitation en attente'; end if;
end $$;
create policy "membres" on public.tasks for all
  using (public.is_squad_member(squad_id)) with check (public.is_squad_member(squad_id));
create policy "membres lisent" on public.squad_messages for select using (public.is_squad_member(squad_id));
create policy "membres écrivent" on public.squad_messages for insert
  with check (author_id = auth.uid() and public.is_squad_member(squad_id));

-- Données privées
create policy "ses notifications" on public.notifications for select using (user_id = auth.uid());
create policy "marquer lu" on public.notifications for update using (user_id = auth.uid());
create policy "son portefeuille" on public.wallets for select using (user_id = auth.uid());
create policy "ses transactions" on public.transactions for select using (user_id = auth.uid() or public.is_moderator());
create policy "ses requêtes Griot" on public.griot_queries for select using (user_id = auth.uid());

create policy "signaler" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "modération" on public.reports for select using (reporter_id = auth.uid() or public.is_moderator());
create policy "traiter" on public.reports for update using (public.is_moderator());

create policy "parties au litige" on public.disputes for select using (
  opened_by = auth.uid() or auth.uid() = any (arbiters) or public.is_moderator()
  or exists (select 1 from public.bounties b where b.id = bounty_id and b.creator_id = auth.uid())
);
create policy "ouvrir un litige" on public.disputes for insert to authenticated with check (opened_by = auth.uid());
create policy "arbitrer" on public.disputes for update using (auth.uid() = any (arbiters) or public.is_moderator());

create policy "voir la session" on public.debug_sessions for select using (true); -- accès par lien
create policy "créer" on public.debug_sessions for insert to authenticated with check (host_id = auth.uid());
create policy "hôte" on public.debug_sessions for update using (host_id = auth.uid());
create policy "participants" on public.debug_participants for select using (public.in_debug_session(session_id));
create policy "rejoindre" on public.debug_participants for insert to authenticated
  with check (user_id = auth.uid() and can_write = false);
create policy "hôte donne la main" on public.debug_participants for update using (
  exists (select 1 from public.debug_sessions s where s.id = session_id and s.host_id = auth.uid())
);
create policy "lire" on public.debug_events for select using (public.in_debug_session(session_id));
create policy "émettre" on public.debug_events for insert
  with check (user_id = auth.uid() and public.in_debug_session(session_id));

-- Les mouvements d'argent passent uniquement par les fonctions security definer :
-- aucune policy d'écriture sur wallets, transactions, escrows, bounties, contributions, submissions.

-- ============================================================
-- Temps réel (XP en direct, badges, Squads, Pair-Debugging)
-- ============================================================
alter publication supabase_realtime add table
  public.notifications, public.profiles, public.squad_messages, public.tasks,
  public.debug_events, public.bounties;
