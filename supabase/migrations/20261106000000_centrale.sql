-- V2 : Centrale d'achat d'infrastructures (§8.2)
-- Coopérative : prix de gros + 10 à 15 %, prépayé (crédits puis portefeuille), plafonds et pause automatique.

insert into public.app_settings (key, value) values
  ('infra_max_resources', '5'),
  ('infra_sms_per_hour', '100'),
  ('infra_rebate_pct', '20') -- part de la marge annuelle reversée aux membres
on conflict (key) do nothing;

alter table public.transactions drop constraint transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in (
  'topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'commission',
  'clone_payment', 'clone_earning', 'clone_refund', 'clone_pass', 'clone_pass_payout',
  'audit_payment', 'audit_payout', 'audit_refund',
  'infra_usage'
));

create table public.infra_offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('calcul', 'base_de_donnees', 'build', 'sms', 'ia', 'monitoring', 'domaine')),
  name text not null,
  provider text not null,
  description text not null,
  unit text not null check (unit in ('heure', 'sms', '1k_jetons', 'an')),
  billing_mode text not null check (billing_mode in ('horaire', 'a_l_usage', 'unique')),
  wholesale_price numeric(10, 2) not null check (wholesale_price > 0),
  price numeric(10, 2) not null,
  public_price numeric(10, 2) not null,
  active boolean not null default true,
  -- Modèle : marge de 10 à 15 % sur le prix de gros, toujours sous le prix public
  check (price between wholesale_price * 1.10 and wholesale_price * 1.15),
  check (price < public_price)
);

create table public.infra_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now()
);

-- Crédits d'infrastructure offerts (lauréats des défis, projets de la semaine, ristourne) : utilisés avant le portefeuille
create table public.infra_credits (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table public.infra_credit_grants (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null check (amount > 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.infra_budgets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  monthly_cap bigint not null check (monthly_cap >= 500),
  alert_month date,
  alerted_level integer not null default 0 -- 0, 50, 80 ou 100 (%)
);

create table public.infra_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  offer_id uuid not null references public.infra_offers (id),
  project_id uuid references public.projects (id) on delete set null,
  squad_id uuid references public.squads (id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'deleted')),
  pause_reason text check (pause_reason in ('manuel', 'budget', 'solde', 'abus_sms')),
  api_key_hash text unique, -- clé d'API personnelle (SMS, IA) : seul le hash est conservé
  api_key_prefix text,
  last_billed_at timestamptz not null default now(),
  last_backup_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.infra_resources (owner_id, status);

create table public.usage_records (
  id bigserial primary key,
  resource_id uuid not null references public.infra_resources (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null,
  amount bigint not null check (amount >= 0), -- FCFA facturés
  from_credits bigint not null default 0,
  margin numeric(12, 2) not null default 0, -- marge de la coopérative (base de la ristourne)
  created_at timestamptz not null default now()
);
create index on public.usage_records (owner_id, created_at desc);
create index on public.usage_records (resource_id, created_at desc);

-- Gouvernance : les membres votent les prochains fournisseurs et services à négocier
create table public.infra_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 120),
  description text,
  proposed_by uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'negotiating', 'available', 'rejected')),
  created_at timestamptz not null default now()
);
create table public.infra_proposal_votes (
  proposal_id uuid references public.infra_proposals (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table public.infra_rebates (
  year integer primary key,
  pool bigint not null,
  distributed_at timestamptz not null default now()
);

-- ============================================================
-- Adhésion, budget, ressources
-- ============================================================
create or replace function public.is_infra_member(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from infra_members where user_id = p_user);
$$;

create or replace function public.join_centrale()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into infra_members (user_id) values (auth.uid()) on conflict do nothing;
  insert into infra_credits (user_id) values (auth.uid()) on conflict do nothing;
end $$;

create or replace function public.set_infra_budget(p_cap bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_infra_member(auth.uid()) then raise exception 'Adhère d''abord à la Centrale'; end if;
  insert into infra_budgets (user_id, monthly_cap) values (auth.uid(), p_cap)
  on conflict (user_id) do update set monthly_cap = excluded.monthly_cap, alerted_level = 0, alert_month = null;
  -- Un plafond relevé permet de reprendre les ressources mises en pause pour cause de budget
end $$;

create or replace function public.infra_month_spend(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::bigint from usage_records
  where owner_id = p_user and created_at >= date_trunc('month', now());
$$;

-- Facture une consommation : crédits d'abord, puis portefeuille. Gère les alertes de budget et la pause automatique.
create or replace function public.record_usage(p_resource uuid, p_quantity numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r infra_resources%rowtype;
  o infra_offers%rowtype;
  v_amount bigint;
  v_credits bigint;
  v_wallet bigint;
  v_from_credits bigint;
  v_spend bigint;
  b infra_budgets%rowtype;
  v_level integer;
  v_month date := date_trunc('month', now())::date;
begin
  select * into r from infra_resources where id = p_resource for update;
  select * into o from infra_offers where id = r.offer_id;
  if r.status <> 'active' then raise exception 'Ressource en pause'; end if;
  if p_quantity <= 0 then return jsonb_build_object('amount', 0); end if;

  v_amount := ceil(p_quantity * o.price)::bigint;
  select balance into v_credits from infra_credits where user_id = r.owner_id for update;
  select balance into v_wallet from wallets where user_id = r.owner_id;
  v_credits := coalesce(v_credits, 0);

  if v_credits + coalesce(v_wallet, 0) < v_amount then
    -- Prépayé : pas de dette, la ressource s'arrête plutôt qu'une facture surprise
    update infra_resources set status = 'paused', pause_reason = 'solde' where owner_id = r.owner_id and status = 'active';
    insert into notifications (user_id, kind, payload)
    values (r.owner_id, 'infra_paused', jsonb_build_object('reason', 'solde'));
    return jsonb_build_object('amount', 0, 'paused', 'solde');
  end if;

  v_from_credits := least(v_credits, v_amount);
  if v_from_credits > 0 then
    update infra_credits set balance = balance - v_from_credits, updated_at = now() where user_id = r.owner_id;
  end if;
  if v_amount - v_from_credits > 0 then
    perform wallet_move(r.owner_id, -(v_amount - v_from_credits), 'infra_usage', 'infra_resource', r.id);
  end if;
  insert into usage_records (resource_id, owner_id, quantity, unit, amount, from_credits, margin)
  values (r.id, r.owner_id, p_quantity, o.unit, v_amount, v_from_credits, p_quantity * (o.price - o.wholesale_price));
  if o.billing_mode = 'horaire' then update infra_resources set last_billed_at = now() where id = r.id; end if;

  -- Plafond mensuel : alertes à 50, 80 et 100 %, pause automatique à 100 %
  select * into b from infra_budgets where user_id = r.owner_id for update;
  if b.user_id is not null then
    v_spend := infra_month_spend(r.owner_id);
    v_level := case when v_spend >= b.monthly_cap then 100 when v_spend * 10 >= b.monthly_cap * 8 then 80
                    when v_spend * 2 >= b.monthly_cap then 50 else 0 end;
    if b.alert_month is distinct from v_month then b.alerted_level := 0; end if;
    if v_level > b.alerted_level then
      update infra_budgets set alerted_level = v_level, alert_month = v_month where user_id = r.owner_id;
      insert into notifications (user_id, kind, payload)
      values (r.owner_id, 'infra_budget', jsonb_build_object('level', v_level, 'spend', v_spend, 'cap', b.monthly_cap));
      if v_level = 100 then
        update infra_resources set status = 'paused', pause_reason = 'budget' where owner_id = r.owner_id and status = 'active';
        return jsonb_build_object('amount', v_amount, 'paused', 'budget');
      end if;
    end if;
  end if;
  return jsonb_build_object('amount', v_amount, 'from_credits', v_from_credits);
end $$;
revoke execute on function public.record_usage from public, anon, authenticated;

-- Création en un clic. Retourne la clé d'API (une seule fois) pour les offres SMS et IA.
create or replace function public.create_infra_resource(p_offer_code text, p_name text, p_project uuid, p_squad uuid)
returns table (resource_id uuid, api_key text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  o infra_offers%rowtype;
  v_max integer := (select (value #>> '{}')::int from app_settings where key = 'infra_max_resources');
  v_key text;
  v_id uuid;
  b infra_budgets%rowtype;
begin
  if not is_infra_member(auth.uid()) then raise exception 'Adhère d''abord à la Centrale d''achat'; end if;
  select * into o from infra_offers where code = p_offer_code and active;
  if o.id is null then raise exception 'Offre introuvable'; end if;
  if (select count(*) from infra_resources where owner_id = auth.uid() and status <> 'deleted') >= v_max then
    raise exception 'Quota atteint : % ressources par compte', v_max;
  end if;
  if p_project is not null and not exists (select 1 from projects where id = p_project and owner_id = auth.uid()) then
    raise exception 'Ce projet ne t''appartient pas';
  end if;
  if p_squad is not null and not public.is_squad_member(p_squad) then raise exception 'Tu n''es pas membre de cette Squad'; end if;
  select * into b from infra_budgets where user_id = auth.uid();
  if b.user_id is not null and infra_month_spend(auth.uid()) >= b.monthly_cap then
    raise exception 'Plafond mensuel atteint : relève-le pour créer une ressource';
  end if;

  if o.category in ('sms', 'ia') then v_key := 'bk_' || encode(gen_random_bytes(24), 'hex'); end if;
  insert into infra_resources (owner_id, offer_id, project_id, squad_id, name, api_key_hash, api_key_prefix,
                               last_backup_at)
  values (auth.uid(), o.id, p_project, p_squad, trim(p_name),
          case when v_key is not null then encode(digest(v_key, 'sha256'), 'hex') end,
          case when v_key is not null then left(v_key, 10) end,
          case when o.category = 'base_de_donnees' then now() end)
  returning id into v_id;

  if o.billing_mode = 'unique' then
    -- Le domaine est réglé à la réservation ; sans solde suffisant, rien n'est créé
    if (select coalesce(sum(balance), 0) from (select balance from infra_credits where user_id = auth.uid()
          union all select balance from wallets where user_id = auth.uid()) x) < ceil(o.price) then
      raise exception 'Solde insuffisant : % FCFA nécessaires', ceil(o.price);
    end if;
    perform record_usage(v_id, 1);
  end if;
  return query select v_id, v_key;
end $$;

create or replace function public.set_infra_resource_status(p_resource uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare r infra_resources%rowtype; b infra_budgets%rowtype; v_funds bigint;
begin
  select * into r from infra_resources where id = p_resource for update;
  if r.owner_id is distinct from auth.uid() then raise exception 'Ressource introuvable'; end if;
  if r.status = 'deleted' then raise exception 'Ressource supprimée'; end if;
  if p_status = 'active' then
    if r.pause_reason = 'abus_sms' then raise exception 'Suspendue pour envoi massif de SMS : contacte la modération'; end if;
    select * into b from infra_budgets where user_id = auth.uid();
    if b.user_id is not null and infra_month_spend(auth.uid()) >= b.monthly_cap then
      raise exception 'Plafond mensuel atteint : relève-le pour reprendre';
    end if;
    select coalesce((select balance from infra_credits where user_id = auth.uid()), 0)
         + coalesce((select balance from wallets where user_id = auth.uid()), 0) into v_funds;
    if v_funds <= 0 then raise exception 'Solde épuisé : recharge ton portefeuille en Mobile Money'; end if;
    update infra_resources set status = 'active', pause_reason = null, last_billed_at = now() where id = r.id;
  elsif p_status = 'paused' then
    update infra_resources set status = 'paused', pause_reason = 'manuel' where id = r.id;
  elsif p_status = 'deleted' then
    update infra_resources set status = 'deleted', deleted_at = now(), api_key_hash = null where id = r.id;
  else
    raise exception 'Statut invalide';
  end if;
end $$;

-- Tâche planifiée : facture les heures écoulées des ressources horaires, sauvegarde les bases
create or replace function public.meter_infra()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_hours numeric; v_billed integer := 0; v_backups integer;
begin
  for r in
    select ir.id, ir.last_billed_at from infra_resources ir join infra_offers o on o.id = ir.offer_id
    where ir.status = 'active' and o.billing_mode = 'horaire'
  loop
    v_hours := floor(extract(epoch from now() - r.last_billed_at) / 3600);
    if v_hours >= 1 then
      perform record_usage(r.id, v_hours);
      update infra_resources set last_billed_at = r.last_billed_at + make_interval(hours => v_hours::int) where id = r.id;
      v_billed := v_billed + 1;
    end if;
  end loop;
  update infra_resources ir set last_backup_at = now()
  from infra_offers o
  where o.id = ir.offer_id and o.category = 'base_de_donnees' and ir.status <> 'deleted'
    and (ir.last_backup_at is null or ir.last_backup_at < now() - interval '1 day');
  get diagnostics v_backups = row_count;
  return jsonb_build_object('billed', v_billed, 'backups', v_backups);
end $$;
revoke execute on function public.meter_infra from public, anon, authenticated;

-- Détection d'abus : envoi massif de SMS (spam) → ressource suspendue
create or replace function public.check_sms_abuse(p_resource uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_limit integer := (select (value #>> '{}')::int from app_settings where key = 'infra_sms_per_hour'); v_sent numeric; v_owner uuid;
begin
  select coalesce(sum(quantity), 0) into v_sent from usage_records
  where resource_id = p_resource and created_at > now() - interval '1 hour';
  if v_sent >= v_limit then
    update infra_resources set status = 'paused', pause_reason = 'abus_sms' where id = p_resource returning owner_id into v_owner;
    insert into notifications (user_id, kind, payload)
    values (v_owner, 'infra_paused', jsonb_build_object('reason', 'abus_sms', 'resource_id', p_resource));
    return true;
  end if;
  return false;
end $$;
revoke execute on function public.check_sms_abuse from public, anon, authenticated;

-- ============================================================
-- Coopérative : crédits offerts, ristourne, propositions
-- ============================================================
create or replace function public.grant_infra_credits(p_user uuid, p_amount bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into infra_credits (user_id, balance) values (p_user, p_amount)
  on conflict (user_id) do update set balance = infra_credits.balance + excluded.balance, updated_at = now();
  insert into infra_credit_grants (user_id, amount, reason) values (p_user, p_amount, p_reason);
  insert into notifications (user_id, kind, payload)
  values (p_user, 'infra_credits', jsonb_build_object('amount', p_amount, 'reason', p_reason));
end $$;
revoke execute on function public.grant_infra_credits from public, anon, authenticated;

-- Crédits offerts automatiquement aux lauréats des défis et aux projets de la semaine
create or replace function public.on_points_infra_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reason = 'challenge_won' then
    perform grant_infra_credits(new.user_id, new.amount * 20, 'Podium d''un défi');
  elsif new.reason = 'project_of_week' then
    perform grant_infra_credits(new.user_id, 3000, 'Projet de la semaine');
  end if;
  return new;
end $$;
create trigger points_infra_credits after insert on public.points_log
  for each row execute function public.on_points_infra_credits();

-- Ristourne annuelle : 20 % de la marge de l'année, au prorata de la consommation, en crédits
create or replace function public.distribute_infra_rebate(p_year integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pct integer := (select (value #>> '{}')::int from app_settings where key = 'infra_rebate_pct');
  v_pool bigint;
  v_total bigint;
  r record;
  n integer := 0;
begin
  if not is_moderator() and coalesce(auth.role(), '') <> 'service_role' then raise exception 'Réservé à l''administration'; end if;
  if exists (select 1 from infra_rebates where year = p_year) then raise exception 'Ristourne % déjà versée', p_year; end if;
  select floor(coalesce(sum(margin), 0) * v_pct / 100), coalesce(sum(amount), 0) into v_pool, v_total
  from usage_records where extract(year from created_at) = p_year;
  insert into infra_rebates (year, pool) values (p_year, v_pool);
  if v_pool = 0 or v_total = 0 then return 0; end if;
  for r in
    select owner_id, sum(amount) as spent from usage_records where extract(year from created_at) = p_year group by owner_id
  loop
    if floor(v_pool * r.spent / v_total) > 0 then
      perform grant_infra_credits(r.owner_id, floor(v_pool * r.spent / v_total)::bigint, 'Ristourne coopérative ' || p_year);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.vote_infra_proposal(p_proposal uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not is_infra_member(auth.uid()) then raise exception 'Seuls les membres de la Centrale votent'; end if;
  insert into infra_proposal_votes (proposal_id, user_id) values (p_proposal, auth.uid())
  on conflict do nothing;
  if not found then delete from infra_proposal_votes where proposal_id = p_proposal and user_id = auth.uid(); end if;
  return (select count(*)::int from infra_proposal_votes where proposal_id = p_proposal);
end $$;

-- Tableau de bord : consommation par jour sur 30 jours
create or replace function public.infra_daily_usage()
returns table (day date, amount bigint)
language sql stable security definer set search_path = public as $$
  select d::date, coalesce(sum(u.amount), 0)::bigint
  from generate_series(current_date - 29, current_date, interval '1 day') d
  left join usage_records u on u.owner_id = auth.uid() and u.created_at::date = d::date
  group by d order by d;
$$;

create or replace function public.cron_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev date := (date_trunc('month', now()) - interval '1 month')::date;
begin
  return jsonb_build_object(
    'expired_bounties', expire_bounties(),
    'clone_pass_payouts', distribute_clone_passes(v_prev),
    'refunded_audits', expire_audits(),
    'infra', meter_infra()
  );
end $$;
revoke execute on function public.cron_daily from public, anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.infra_offers enable row level security;
alter table public.infra_members enable row level security;
alter table public.infra_credits enable row level security;
alter table public.infra_credit_grants enable row level security;
alter table public.infra_budgets enable row level security;
alter table public.infra_resources enable row level security;
alter table public.usage_records enable row level security;
alter table public.infra_proposals enable row level security;
alter table public.infra_proposal_votes enable row level security;
alter table public.infra_rebates enable row level security;

create policy "catalogue public" on public.infra_offers for select using (true);
create policy "membres visibles" on public.infra_members for select using (true);
create policy "mes crédits" on public.infra_credits for select using (user_id = auth.uid());
create policy "mes crédits offerts" on public.infra_credit_grants for select using (user_id = auth.uid());
create policy "mon budget" on public.infra_budgets for select using (user_id = auth.uid());
-- Les ressources d'une Squad sont visibles de ses membres ; seul le propriétaire les pilote
create policy "mes ressources" on public.infra_resources for select
  using (owner_id = auth.uid() or (squad_id is not null and public.is_squad_member(squad_id)) or public.is_moderator());
-- Le hash de la clé d'API ne sort jamais : lecture colonne par colonne
revoke select on public.infra_resources from anon, authenticated;
grant select (id, owner_id, offer_id, project_id, squad_id, name, status, pause_reason, api_key_prefix,
              last_billed_at, last_backup_at, created_at, deleted_at) on public.infra_resources to authenticated;
create policy "ma consommation" on public.usage_records for select using (owner_id = auth.uid() or public.is_moderator());
create policy "propositions publiques" on public.infra_proposals for select using (true);
create policy "proposer" on public.infra_proposals for insert to authenticated
  with check (proposed_by = auth.uid() and status = 'open' and public.is_infra_member(auth.uid()));
create policy "modération" on public.infra_proposals for update using (public.is_moderator());
create policy "votes publics" on public.infra_proposal_votes for select using (true);
create policy "ristournes publiques" on public.infra_rebates for select using (true);

-- Correctif de sécurité : XP et badges ne s'attribuent que par les règles du jeu (fonctions internes),
-- jamais par un appel direct d'un utilisateur.
revoke execute on function public.add_points(uuid, integer, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.award_badge(uuid, text) from public, anon, authenticated;
