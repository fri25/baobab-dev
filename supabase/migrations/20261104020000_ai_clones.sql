-- V2 : clone IA du senior (§6.2)
-- 100 FCFA par question (la première gratuite), Pass Clones 2 000 FCFA / mois, 70 % au senior, 30 % à la plateforme.

create extension if not exists unaccent with schema extensions;

insert into public.app_settings (key, value) values
  ('clone_price', '100'),
  ('clone_pass_price', '2000'),
  ('clone_owner_share_pct', '70'),
  ('clone_min_xp', '2000'),
  ('clone_suspend_below', '2.5')
on conflict (key) do nothing;

-- Nouveaux mouvements du portefeuille
alter table public.transactions drop constraint transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in (
  'topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'commission',
  'clone_payment', 'clone_earning', 'clone_refund', 'clone_pass', 'clone_pass_payout'
));

create table public.ai_clones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null,
  specialty text not null,
  description text,
  style_notes text, -- ton, méthodes, habitudes du senior
  status text not null default 'draft' check (status in ('draft', 'published', 'suspended')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Sources choisies par le senior : ses réponses validées ou ses notes (tutoriels, revues de code…)
create table public.clone_sources (
  id uuid primary key default gen_random_uuid(),
  clone_id uuid not null references public.ai_clones (id) on delete cascade,
  kind text not null check (kind in ('answer', 'note')),
  answer_id uuid references public.answers (id) on delete cascade,
  title text not null,
  content text not null,
  search tsvector generated always as (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') || setweight(to_tsvector('french', content), 'B')
  ) stored,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  unique (clone_id, answer_id)
);
create index on public.clone_sources using gin (search);

create table public.clone_queries (
  id uuid primary key default gen_random_uuid(),
  clone_id uuid not null references public.ai_clones (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  question_key text not null, -- question normalisée : les répétitions ne sont pas comptées
  answer text not null,
  status text not null check (status in ('answered', 'out_of_scope', 'no_source')),
  billing text not null check (billing in ('owner_test', 'free_first', 'paid', 'pass', 'repeat', 'not_billed')),
  price integer not null default 0,
  owner_earning integer not null default 0,
  cited_sources uuid[] not null default '{}',
  rating smallint check (rating between 1 and 5),
  flagged_reason text,
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.clone_queries (clone_id, created_at desc);
create index on public.clone_queries (user_id, clone_id);

create table public.clone_passes (
  user_id uuid references public.profiles (id) on delete cascade,
  month date not null, -- premier jour du mois
  amount integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table public.clone_pass_distributions (
  month date primary key,
  pool integer not null,
  distributed_at timestamptz not null default now()
);

create or replace function public.normalize_question(p text)
returns text language sql immutable as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g');
$$;

-- ============================================================
-- Création et gestion par le senior
-- ============================================================
create or replace function public.create_clone(p_name text, p_specialty text, p_description text, p_style text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_xp integer; v_min integer := (select value::int from app_settings where key = 'clone_min_xp');
begin
  select xp into v_xp from profiles where id = auth.uid();
  if coalesce(v_xp, 0) < v_min then
    raise exception 'Le clone IA est réservé aux devs de niveau Expert (% XP)', v_min;
  end if;
  insert into ai_clones (owner_id, name, specialty, description, style_notes)
  values (auth.uid(), trim(p_name), trim(p_specialty), nullif(trim(p_description), ''), nullif(trim(p_style), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Ajoute une de ses réponses comme source (réponse validée ou votée positivement)
create or replace function public.add_clone_answer_source(p_answer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_clone uuid; a answers%rowtype; v_title text;
begin
  select id into v_clone from ai_clones where owner_id = auth.uid();
  select * into a from answers where id = p_answer_id and author_id = auth.uid();
  if v_clone is null or a.id is null then raise exception 'Réponse ou clone introuvable'; end if;
  if not a.is_accepted and a.score < 1 then raise exception 'Seules les réponses validées ou votées positivement servent de source'; end if;
  select title into v_title from questions where id = a.question_id;
  insert into clone_sources (clone_id, kind, answer_id, title, content)
  values (v_clone, 'answer', a.id, v_title, a.body)
  on conflict (clone_id, answer_id) do nothing;
end $$;

-- Publication : au moins 3 sources pour ne jamais répondre « dans le vide »
create or replace function public.set_clone_status(p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare c ai_clones%rowtype;
begin
  select * into c from ai_clones where owner_id = auth.uid() for update;
  if c.id is null then raise exception 'Clone introuvable'; end if;
  if c.status = 'suspended' and not is_moderator() then raise exception 'Clone suspendu : contacte la modération'; end if;
  if p_status = 'published' and (select count(*) from clone_sources where clone_id = c.id) < 3 then
    raise exception 'Ajoute au moins 3 sources avant de publier ton clone';
  end if;
  if p_status not in ('draft', 'published') then raise exception 'Statut invalide'; end if;
  update ai_clones set status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, now()) end
  where id = c.id;
end $$;

-- ============================================================
-- Facturation
-- ============================================================
create or replace function public.has_clone_pass(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clone_passes where user_id = p_user and month = date_trunc('month', now())::date);
$$;

-- Mode de facturation d'une question, sans débiter
create or replace function public.clone_billing(p_user uuid, p_clone uuid, p_question text)
returns table (billing text, price integer, balance bigint)
language plpgsql stable security definer set search_path = public as $$
declare c ai_clones%rowtype; v_price integer := (select value::int from app_settings where key = 'clone_price');
begin
  select * into c from ai_clones where id = p_clone;
  select w.balance into balance from wallets w where w.user_id = p_user;
  if c.owner_id = p_user then billing := 'owner_test'; price := 0; return next; return; end if;
  if exists (select 1 from clone_queries q where q.clone_id = p_clone and q.user_id = p_user
             and q.question_key = normalize_question(p_question) and q.created_at > now() - interval '24 hours') then
    billing := 'repeat'; price := 0; return next; return;
  end if;
  if not exists (select 1 from clone_queries q where q.clone_id = p_clone and q.user_id = p_user and q.billing <> 'not_billed') then
    billing := 'free_first'; price := 0; return next; return;
  end if;
  if has_clone_pass(p_user) then billing := 'pass'; price := 0; return next; return; end if;
  billing := 'paid'; price := v_price; return next;
end $$;

-- Enregistre la réponse et facture (appelé par le serveur uniquement, après génération)
create or replace function public.record_clone_query(
  p_user uuid, p_clone uuid, p_question text, p_answer text, p_status text, p_cited uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  c ai_clones%rowtype;
  b record;
  v_id uuid;
  v_share integer;
  v_pct integer := (select value::int from app_settings where key = 'clone_owner_share_pct');
begin
  select * into c from ai_clones where id = p_clone;
  if c.status <> 'published' and c.owner_id <> p_user then raise exception 'Clone indisponible'; end if;
  select * into b from clone_billing(p_user, p_clone, p_question);

  -- Pas de facturation sans réponse sourcée (hors domaine ou sans source)
  if p_status <> 'answered' then b.billing := 'not_billed'; b.price := 0; end if;
  if b.billing = 'paid' and b.balance < b.price then raise exception 'Solde insuffisant'; end if;

  v_share := case when b.billing = 'paid' then b.price * v_pct / 100 else 0 end;
  insert into clone_queries (clone_id, user_id, question, question_key, answer, status, billing, price, owner_earning, cited_sources)
  values (p_clone, p_user, p_question, normalize_question(p_question), p_answer, p_status, b.billing, b.price, v_share, coalesce(p_cited, '{}'))
  returning id into v_id;

  if b.billing = 'paid' then
    perform wallet_move(p_user, -b.price, 'clone_payment', 'clone_query', v_id);
    perform wallet_move(c.owner_id, v_share, 'clone_earning', 'clone_query', v_id);
    perform wallet_move(null, b.price - v_share, 'commission', 'clone_query', v_id);
  end if;
  return v_id;
end $$;
revoke execute on function public.record_clone_query from public, anon, authenticated;
revoke execute on function public.clone_billing from public, anon, authenticated;

create or replace function public.buy_clone_pass()
returns void language plpgsql security definer set search_path = public as $$
declare v_price integer := (select value::int from app_settings where key = 'clone_pass_price');
begin
  if has_clone_pass(auth.uid()) then raise exception 'Ton Pass Clones est déjà actif ce mois-ci'; end if;
  insert into clone_passes (user_id, month, amount) values (auth.uid(), date_trunc('month', now())::date, v_price);
  perform wallet_move(auth.uid(), -v_price, 'clone_pass', 'clone_pass', null);
  perform wallet_move(null, v_price, 'clone_pass', 'clone_pass', null);
end $$;

-- Fin de mois : 70 % des Pass répartis entre seniors au prorata des questions traitées (tâche quotidienne)
create or replace function public.distribute_clone_passes(p_month date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pool integer;
  v_total integer;
  v_pct integer := (select value::int from app_settings where key = 'clone_owner_share_pct');
  r record;
  v_paid integer := 0;
begin
  if exists (select 1 from clone_pass_distributions where month = p_month) then return 0; end if;
  select coalesce(sum(amount), 0) * v_pct / 100 into v_pool from clone_passes where month = p_month;
  select count(*) into v_total from clone_queries
  where billing = 'pass' and not refunded and date_trunc('month', created_at)::date = p_month;
  insert into clone_pass_distributions (month, pool) values (p_month, v_pool);
  if v_pool = 0 or v_total = 0 then return 0; end if;

  for r in
    select c.owner_id, count(*) as n from clone_queries q join ai_clones c on c.id = q.clone_id
    where q.billing = 'pass' and not q.refunded and date_trunc('month', q.created_at)::date = p_month
    group by c.owner_id
  loop
    perform wallet_move(r.owner_id, (v_pool * r.n / v_total)::bigint, 'clone_pass_payout', 'clone_pass', null);
    perform wallet_move(null, -(v_pool * r.n / v_total)::bigint, 'clone_pass_payout', 'clone_pass', null);
    v_paid := v_paid + 1;
  end loop;
  return v_paid;
end $$;
revoke execute on function public.distribute_clone_passes from public, anon, authenticated;

create or replace function public.cron_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev date := (date_trunc('month', now()) - interval '1 month')::date;
begin
  return jsonb_build_object(
    'expired_bounties', expire_bounties(),
    'clone_pass_payouts', distribute_clone_passes(v_prev)
  );
end $$;
revoke execute on function public.cron_daily from public, anon, authenticated;

-- ============================================================
-- Avis, signalement, remboursement et suspension
-- ============================================================
create or replace function public.check_clone_rating(p_clone uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avg numeric; v_n integer; v_min numeric := (select value::numeric from app_settings where key = 'clone_suspend_below');
  v_owner uuid;
begin
  select avg(rating), count(rating) into v_avg, v_n from clone_queries where clone_id = p_clone and rating is not null;
  if v_n >= 5 and v_avg < v_min then
    update ai_clones set status = 'suspended' where id = p_clone and status = 'published' returning owner_id into v_owner;
    if v_owner is not null then
      insert into notifications (user_id, kind, payload)
      values (v_owner, 'clone_suspended', jsonb_build_object('clone_id', p_clone, 'rating', round(v_avg, 1)));
    end if;
  end if;
end $$;

create or replace function public.rate_clone_query(p_query uuid, p_rating integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_clone uuid;
begin
  update clone_queries set rating = p_rating
  where id = p_query and user_id = auth.uid() and billing <> 'owner_test'
  returning clone_id into v_clone;
  if v_clone is null then raise exception 'Question introuvable'; end if;
  perform check_clone_rating(v_clone);
end $$;

-- Mauvaise réponse signalée : remboursée, et non payée au senior
create or replace function public.flag_clone_query(p_query uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare q clone_queries%rowtype; v_owner uuid;
begin
  select * into q from clone_queries where id = p_query and user_id = auth.uid() for update;
  if q.id is null then raise exception 'Question introuvable'; end if;
  if q.refunded or q.flagged_reason is not null then raise exception 'Déjà signalée'; end if;
  if q.created_at < now() - interval '7 days' then raise exception 'Signalement possible pendant 7 jours'; end if;
  select owner_id into v_owner from ai_clones where id = q.clone_id;

  update clone_queries set flagged_reason = left(p_reason, 500), refunded = q.price > 0, rating = coalesce(rating, 1)
  where id = q.id;
  if q.price > 0 then
    perform wallet_move(v_owner, -q.owner_earning, 'clone_refund', 'clone_query', q.id);
    perform wallet_move(null, -(q.price - q.owner_earning), 'clone_refund', 'clone_query', q.id);
    perform wallet_move(q.user_id, q.price, 'clone_refund', 'clone_query', q.id);
  end if;
  insert into notifications (user_id, kind, payload)
  values (v_owner, 'clone_flagged', jsonb_build_object('clone_id', q.clone_id, 'question', left(q.question, 120)));
  perform check_clone_rating(q.clone_id);
end $$;

-- Tableau de bord du senior
create or replace function public.clone_dashboard()
returns table (
  questions integer, questions_month integer, revenue_month bigint, revenue_total bigint,
  avg_rating numeric, unanswered integer, flagged integer
) language sql stable security definer set search_path = public as $$
  with c as (select id from ai_clones where owner_id = auth.uid()),
       q as (select * from clone_queries where clone_id = (select id from c) and billing <> 'owner_test')
  select (select count(*)::int from q),
         (select count(*)::int from q where created_at >= date_trunc('month', now())),
         (select coalesce(sum(owner_earning), 0) from q where not refunded and created_at >= date_trunc('month', now()))
           + coalesce((select sum(amount) from transactions where user_id = auth.uid() and kind = 'clone_pass_payout'
                       and created_at >= date_trunc('month', now())), 0),
         (select coalesce(sum(owner_earning), 0) from q where not refunded)
           + coalesce((select sum(amount) from transactions where user_id = auth.uid() and kind = 'clone_pass_payout'), 0),
         (select round(avg(rating), 1) from q where rating is not null),
         (select count(*)::int from q where status <> 'answered'),
         (select count(*)::int from q where flagged_reason is not null);
$$;

-- Recherche dans les sources d'un clone
create or replace function public.match_clone_sources_text(p_clone uuid, p_query text, match_count integer default 4)
returns table (id uuid, title text, content text, rank float)
language sql stable security definer set search_path = public as $$
  with q as (select to_tsquery('french', array_to_string(
                      array(select lexeme from unnest(to_tsvector('french', p_query))), ' | ')) as ts)
  select s.id, s.title, s.content, ts_rank(s.search, q.ts)::float
  from clone_sources s, q
  where s.clone_id = p_clone and s.search @@ q.ts
  order by 4 desc limit match_count;
$$;

create or replace function public.match_clone_sources(p_clone uuid, query_embedding extensions.vector(1024), match_count integer default 4)
returns table (id uuid, title text, content text, rank float)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, s.title, s.content, (1 - (s.embedding <=> query_embedding))::float
  from clone_sources s
  where s.clone_id = p_clone and s.embedding is not null and 1 - (s.embedding <=> query_embedding) > 0.7
  order by s.embedding <=> query_embedding limit match_count;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.ai_clones enable row level security;
alter table public.clone_sources enable row level security;
alter table public.clone_queries enable row level security;
alter table public.clone_passes enable row level security;
alter table public.clone_pass_distributions enable row level security;

create policy "clones publiés ou le mien" on public.ai_clones for select
  using (status = 'published' or owner_id = auth.uid() or public.is_moderator());
create policy "modifier mon clone" on public.ai_clones for update using (owner_id = auth.uid());
revoke update on public.ai_clones from authenticated, anon;
grant update (name, specialty, description, style_notes) on public.ai_clones to authenticated;

-- Le contenu des sources reste privé : seul le senior le voit (et le serveur pour répondre)
create policy "mes sources" on public.clone_sources for select
  using (exists (select 1 from public.ai_clones c where c.id = clone_id and c.owner_id = auth.uid()));
create policy "ajouter une note" on public.clone_sources for insert to authenticated
  with check (kind = 'note' and answer_id is null
              and exists (select 1 from public.ai_clones c where c.id = clone_id and c.owner_id = auth.uid()));
create policy "retirer une source" on public.clone_sources for delete
  using (exists (select 1 from public.ai_clones c where c.id = clone_id and c.owner_id = auth.uid()));

create policy "mes questions ou celles à mon clone" on public.clone_queries for select
  using (user_id = auth.uid() or exists (select 1 from public.ai_clones c where c.id = clone_id and c.owner_id = auth.uid()));

create policy "mes pass" on public.clone_passes for select using (user_id = auth.uid());

-- Statistiques publiques des clones (sans le contenu des questions)
create or replace function public.clone_public_stats()
returns table (clone_id uuid, questions integer, avg_rating numeric, ratings integer)
language sql stable security definer set search_path = public as $$
  select c.id, count(q.id)::int, round(avg(q.rating), 1), count(q.rating)::int
  from ai_clones c left join clone_queries q on q.clone_id = c.id and q.billing <> 'owner_test'
  where c.status = 'published'
  group by c.id;
$$;
