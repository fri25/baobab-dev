-- V1 (P2) : défis, Stack Afrique, Micro-Bourse complète (expiration, prolongation, arbitrage)

-- ============================================================
-- Défis communautaires (§5.6)
-- ============================================================
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  kind text not null check (kind in ('algo', 'interface', 'api')),
  grading text not null default 'jury' check (grading in ('jury', 'auto')),
  sponsor_name text,
  sponsor_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  closed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  solution_url text not null,
  note text,
  score numeric(5, 2), -- attribué par le jury (0-100)
  rank integer,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

-- Clôture : +100 / +60 / +30 XP aux trois premiers (§5.7 : victoire +30 à +100)
create or replace function public.close_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_rank integer := 0;
begin
  if not is_moderator() then raise exception 'Réservé à la modération'; end if;
  if exists (select 1 from challenges where id = p_challenge_id and closed_at is not null) then
    raise exception 'Défi déjà clôturé';
  end if;
  for r in
    select id, user_id from challenge_submissions
    where challenge_id = p_challenge_id and score is not null
    order by score desc, created_at
  loop
    v_rank := v_rank + 1;
    update challenge_submissions set rank = v_rank where id = r.id;
    if v_rank <= 3 then
      perform add_points(r.user_id, (array[100, 60, 30])[v_rank], 'challenge_won', 'challenge', p_challenge_id);
      insert into notifications (user_id, kind, payload)
      values (r.user_id, 'challenge_ranked', jsonb_build_object('challenge_id', p_challenge_id, 'rank', v_rank));
    end if;
  end loop;
  update challenges set closed_at = now() where id = p_challenge_id;
end $$;

-- Classement d'un défi par ville ou pays
create or replace function public.challenge_leaderboard(p_challenge_id uuid, p_scope text default 'all', p_value text default null)
returns table (rank bigint, user_id uuid, username text, full_name text, city text, country text, score numeric, solution_url text)
language sql stable set search_path = public as $$
  select row_number() over (order by s.score desc nulls last, s.created_at),
         p.id, p.username, p.full_name, p.city, p.country, s.score, s.solution_url
  from challenge_submissions s join profiles p on p.id = s.user_id
  where s.challenge_id = p_challenge_id
    and case p_scope when 'country' then p.country = p_value when 'city' then p.city = p_value else true end
  order by s.score desc nulls last, s.created_at;
$$;

alter table public.challenges enable row level security;
alter table public.challenge_submissions enable row level security;
create policy "lecture publique" on public.challenges for select using (true);
create policy "modération crée" on public.challenges for insert with check (public.is_moderator());
create policy "modération modifie" on public.challenges for update using (public.is_moderator());
create policy "lecture publique" on public.challenge_submissions for select using (true);
create policy "participer" on public.challenge_submissions for insert to authenticated
  with check (
    user_id = auth.uid() and score is null and rank is null
    and exists (select 1 from public.challenges c where c.id = challenge_id and now() between c.starts_at and c.ends_at)
  );
create policy "jury note" on public.challenge_submissions for update using (public.is_moderator());

-- ============================================================
-- Stack Afrique vérifiée (§7.1)
-- ============================================================
create table public.stack_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null check (category in ('paiement', 'sms', 'ussd', 'identite', 'cartographie', 'autre')),
  description text not null,
  website text,
  docs_url text,
  compatible_versions text,
  code_example text,
  pitfalls text,
  status text not null default 'test' check (status in ('test', 'verifie', 'deconseille')),
  health_url text, -- point de terminaison public surveillé
  health_status text check (health_status in ('up', 'down')),
  health_checked_at timestamptz,
  created_by uuid references public.profiles (id),
  validated_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.stack_attestations (
  item_id uuid references public.stack_items (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  in_production boolean not null default true,
  comment text,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- « Vérifié » : au moins 5 devs en production + validation d'un modérateur
create or replace function public.validate_stack_item(p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not is_moderator() then raise exception 'Réservé à la modération'; end if;
  select count(*) into v_count from stack_attestations where item_id = p_item_id and in_production;
  if p_status = 'verifie' and v_count < 5 then
    raise exception 'Il faut au moins 5 attestations en production (actuellement %)', v_count;
  end if;
  update stack_items set status = p_status, validated_by = auth.uid() where id = p_item_id;
end $$;

-- Alerte de panne : les devs qui l'utilisent en production sont notifiés
create or replace function public.set_stack_health(p_item_id uuid, p_up boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev text; v_name text;
begin
  select health_status, name into v_prev, v_name from stack_items where id = p_item_id;
  update stack_items set health_status = case when p_up then 'up' else 'down' end, health_checked_at = now()
  where id = p_item_id;
  if not p_up and v_prev is distinct from 'down' then
    insert into notifications (user_id, kind, payload)
    select user_id, 'stack_down', jsonb_build_object('item_id', p_item_id, 'name', v_name)
    from stack_attestations where item_id = p_item_id and in_production;
  end if;
end $$;
revoke execute on function public.set_stack_health from public, anon, authenticated;

alter table public.stack_items enable row level security;
alter table public.stack_attestations enable row level security;
create policy "lecture publique" on public.stack_items for select using (true);
create policy "proposer" on public.stack_items for insert to authenticated
  with check (created_by = auth.uid() and status = 'test' and validated_by is null and health_status is null);
create policy "modération" on public.stack_items for update using (public.is_moderator());
create policy "lecture publique" on public.stack_attestations for select using (true);
create policy "attester" on public.stack_attestations for insert to authenticated with check (user_id = auth.uid());
create policy "retirer" on public.stack_attestations for delete using (user_id = auth.uid());

-- ============================================================
-- Micro-Bourse complète (§8.1)
-- ============================================================
alter table public.disputes add column submission_id uuid references public.bounty_submissions (id) on delete set null;

-- Versement interne (tests passés vérifiés par l'appelant)
create or replace function public.do_release_bounty(p_submission_id uuid)
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
  if b.status in ('paid', 'refunded', 'expired') then raise exception 'Ticket déjà clôturé'; end if;

  select amount into v_amount from escrows where bounty_id = b.id and status = 'held' for update;
  v_fee := v_amount * v_pct / 100;

  update escrows set amount = 0, status = 'released', updated_at = now() where bounty_id = b.id;
  perform wallet_move(s.user_id, v_amount - v_fee, 'escrow_release', 'bounty', b.id);
  perform wallet_move(null, v_fee, 'commission', 'bounty', b.id);

  update bounty_submissions set status = 'accepted' where id = s.id;
  update bounty_submissions set status = 'rejected' where bounty_id = b.id and id <> s.id and status = 'submitted';
  update bounties set status = 'paid', winner_id = s.user_id, paid_at = now() where id = b.id;

  perform add_points(s.user_id, least(150, 40 + (v_amount / 1000)::int * 2), 'bounty_resolved', 'bounty', b.id);
  perform award_badge(s.user_id, 'chasseur_primes_bronze');
  if (select count(*) from bounties where winner_id = s.user_id) >= 10 then
    perform award_badge(s.user_id, 'chasseur_primes_argent');
  end if;
  insert into notifications (user_id, kind, payload)
  values (s.user_id, 'bounty_paid', jsonb_build_object('bounty_id', b.id, 'amount', v_amount - v_fee));
end $$;
revoke execute on function public.do_release_bounty from public, anon, authenticated;

create or replace function public.release_bounty(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s bounty_submissions%rowtype; v_creator uuid;
begin
  select * into s from bounty_submissions where id = p_submission_id;
  select creator_id into v_creator from bounties where id = s.bounty_id;
  if v_creator is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Seul le créateur du ticket peut fusionner';
  end if;
  if s.tests_status <> 'passed' then raise exception 'Les tests d''acceptation ne passent pas'; end if;
  perform do_release_bounty(p_submission_id);
end $$;

-- Remboursement des contributeurs au prorata de leurs apports
create or replace function public.do_refund_bounty(p_bounty_id uuid, p_status text default 'refunded')
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  perform 1 from escrows where bounty_id = p_bounty_id and status = 'held' for update;
  if not found then raise exception 'Aucun fonds en séquestre'; end if;
  for c in select user_id, sum(amount)::bigint as amount from bounty_contributions where bounty_id = p_bounty_id group by user_id loop
    perform wallet_move(c.user_id, c.amount, 'escrow_refund', 'bounty', p_bounty_id);
    insert into notifications (user_id, kind, payload)
    values (c.user_id, 'bounty_refunded', jsonb_build_object('bounty_id', p_bounty_id, 'amount', c.amount));
  end loop;
  update escrows set amount = 0, status = 'refunded', updated_at = now() where bounty_id = p_bounty_id;
  update bounties set status = p_status where id = p_bounty_id;
  update bounty_submissions set status = 'rejected' where bounty_id = p_bounty_id and status = 'submitted';
end $$;
revoke execute on function public.do_refund_bounty from public, anon, authenticated;

-- Tickets expirés sans solution : remboursement (tâche planifiée)
create or replace function public.expire_bounties()
returns integer language plpgsql security definer set search_path = public as $$
declare b record; n integer := 0;
begin
  for b in
    select id from bounties
    where deadline < now() and status in ('open', 'reserved', 'in_review')
      and not exists (select 1 from disputes d where d.bounty_id = bounties.id and d.status = 'open')
  loop
    perform do_refund_bounty(b.id, 'expired');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.expire_bounties from public, anon, authenticated;

-- Prolongation votée par les contributeurs, pondérée par les montants
create table public.bounty_extension_votes (
  bounty_id uuid references public.bounties (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  days integer not null check (days between 1 and 30),
  created_at timestamptz not null default now(),
  primary key (bounty_id, user_id)
);
alter table public.bounty_extension_votes enable row level security;
create policy "lecture publique" on public.bounty_extension_votes for select using (true);

create or replace function public.vote_bounty_extension(p_bounty_id uuid, p_days integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_total bigint; v_yes bigint; v_days integer;
begin
  if not exists (select 1 from bounty_contributions where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'Seuls les contributeurs votent la prolongation';
  end if;
  if not exists (select 1 from bounties where id = p_bounty_id and status in ('open', 'reserved', 'in_review')) then
    raise exception 'Ticket fermé';
  end if;
  insert into bounty_extension_votes (bounty_id, user_id, days) values (p_bounty_id, auth.uid(), p_days)
  on conflict (bounty_id, user_id) do update set days = excluded.days;

  select sum(amount) into v_total from bounty_contributions where bounty_id = p_bounty_id;
  select coalesce(sum(c.amount), 0), min(v.days) into v_yes, v_days
  from bounty_extension_votes v
  join (select user_id, sum(amount) amount from bounty_contributions where bounty_id = p_bounty_id group by user_id) c
    on c.user_id = v.user_id
  where v.bounty_id = p_bounty_id;

  if v_yes * 2 > v_total then
    update bounties set deadline = greatest(deadline, now()) + make_interval(days => v_days) where id = p_bounty_id;
    delete from bounty_extension_votes where bounty_id = p_bounty_id;
    return true;
  end if;
  return false;
end $$;

-- Litige : 3 seniors (niveau Expert, 2 000 XP) tirés au sort, hors parties prenantes
create table public.dispute_votes (
  dispute_id uuid references public.disputes (id) on delete cascade,
  arbiter_id uuid references public.profiles (id) on delete cascade,
  decision text not null check (decision in ('pay', 'refund')),
  comment text,
  created_at timestamptz not null default now(),
  primary key (dispute_id, arbiter_id)
);
alter table public.dispute_votes enable row level security;
create policy "parties et arbitres" on public.dispute_votes for select using (
  exists (select 1 from public.disputes d where d.id = dispute_id
          and (auth.uid() = any (d.arbiters) or d.opened_by = auth.uid() or public.is_moderator()))
);

create or replace function public.on_dispute_opened()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_creator uuid;
begin
  select creator_id into v_creator from bounties where id = new.bounty_id;
  select coalesce(array_agg(id), '{}') into new.arbiters from (
    select p.id from profiles p
    where p.xp >= 2000
      and p.id not in (v_creator, new.opened_by)
      and p.id not in (select user_id from bounty_contributions where bounty_id = new.bounty_id)
      and p.id not in (select user_id from bounty_submissions where bounty_id = new.bounty_id)
    order by random() limit 3
  ) a;
  if new.submission_id is null then
    select id into new.submission_id from bounty_submissions
    where bounty_id = new.bounty_id and status = 'submitted' order by created_at desc limit 1;
  end if;
  return new;
end $$;
create trigger disputes_pick_arbiters before insert on public.disputes
  for each row execute function public.on_dispute_opened();

create or replace function public.after_dispute_opened()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update bounties set status = 'disputed' where id = new.bounty_id;
  insert into notifications (user_id, kind, payload)
  select a, 'dispute_arbiter', jsonb_build_object('bounty_id', new.bounty_id, 'dispute_id', new.id)
  from unnest(new.arbiters) a;
  return new;
end $$;
create trigger disputes_opened after insert on public.disputes
  for each row execute function public.after_dispute_opened();

-- Vote d'arbitrage : la majorité des arbitres (ou un modérateur) tranche
create or replace function public.vote_dispute(p_dispute_id uuid, p_decision text, p_comment text default null)
returns text language plpgsql security definer set search_path = public as $$
declare d disputes%rowtype; v_pay integer; v_refund integer; v_needed integer; v_decision text;
begin
  select * into d from disputes where id = p_dispute_id for update;
  if d.status <> 'open' then raise exception 'Litige déjà tranché'; end if;

  if is_moderator() and not (auth.uid() = any (d.arbiters)) then
    v_decision := p_decision; -- décision directe de la modération (pas assez de seniors)
  else
    if not (auth.uid() = any (d.arbiters)) then raise exception 'Tu n''es pas arbitre de ce litige'; end if;
    insert into dispute_votes (dispute_id, arbiter_id, decision, comment)
    values (p_dispute_id, auth.uid(), p_decision, p_comment)
    on conflict (dispute_id, arbiter_id) do update set decision = excluded.decision, comment = excluded.comment;
    select count(*) filter (where decision = 'pay'), count(*) filter (where decision = 'refund')
      into v_pay, v_refund from dispute_votes where dispute_id = p_dispute_id;
    v_needed := cardinality(d.arbiters) / 2 + 1;
    v_decision := case when v_pay >= v_needed then 'pay' when v_refund >= v_needed then 'refund' end;
  end if;

  if v_decision is null then return 'pending'; end if;
  if v_decision = 'pay' and d.submission_id is null then raise exception 'Aucune Pull Request à payer'; end if;

  update bounties set status = 'in_review' where id = d.bounty_id; -- débloque pour l'exécution
  if v_decision = 'pay' then perform do_release_bounty(d.submission_id);
  else perform do_refund_bounty(d.bounty_id);
  end if;
  update disputes set status = 'resolved', decision = v_decision, resolved_at = now() where id = p_dispute_id;
  return v_decision;
end $$;

-- Tâche quotidienne, appelée par /api/cron (service_role)
create or replace function public.cron_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object('expired_bounties', expire_bounties());
end $$;
revoke execute on function public.cron_daily from public, anon, authenticated;

alter publication supabase_realtime add table public.challenge_submissions;
