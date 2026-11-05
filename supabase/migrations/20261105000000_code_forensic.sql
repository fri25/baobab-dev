-- V2 : Code Forensic, audit de dette technique par les pairs (§7.6)

insert into public.app_settings (key, value) values
  ('audit_min_fee', '10000'),
  ('audit_auditor_share_pct', '70'),
  ('audit_min_xp', '2000')
on conflict (key) do nothing;

alter table public.transactions drop constraint transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in (
  'topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'commission',
  'clone_payment', 'clone_earning', 'clone_refund', 'clone_pass', 'clone_pass_payout',
  'audit_payment', 'audit_payout', 'audit_refund'
));

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  repo_url text not null,
  context text not null, -- lancement, levée de fonds, reprise de code…
  confidentiality text not null default 'private' check (confidentiality in ('public', 'private')),
  max_auditors integer not null default 3 check (max_auditors between 3 and 5),
  fee bigint not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed', 'refunded')),
  deadline timestamptz not null,
  auto_report jsonb, -- résumé de l'analyse automatique
  score integer check (score between 0 and 100),
  effort_hours numeric(6, 1),
  certificate_code text unique,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.audit_auditors (
  audit_id uuid references public.audits (id) on delete cascade,
  auditor_id uuid references public.profiles (id) on delete cascade,
  nda_accepted_at timestamptz not null, -- accord de confidentialité électronique
  joined_at timestamptz not null default now(),
  paid bigint not null default 0,
  rating smallint check (rating between 1 and 5), -- note donnée par le porteur
  primary key (audit_id, auditor_id)
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  auditor_id uuid references public.profiles (id) on delete set null, -- null : analyse automatique
  source text not null check (source in ('auto', 'auditor')),
  category text not null check (category in ('securite', 'dependances', 'duplication', 'tests', 'architecture', 'performance', 'autre')),
  severity text not null check (severity in ('critique', 'moyen', 'mineur')),
  title text not null,
  description text not null,
  fix text, -- piste de correction
  file_path text,
  effort_hours numeric(5, 1) not null default 1 check (effort_hours > 0),
  status text not null default 'open' check (status in ('open', 'contested', 'upheld', 'dismissed')),
  contest_reason text,
  created_at timestamptz not null default now()
);
create index on public.audit_findings (audit_id);

create table public.audit_votes (
  finding_id uuid references public.audit_findings (id) on delete cascade,
  auditor_id uuid references public.profiles (id) on delete cascade,
  uphold boolean not null,
  created_at timestamptz not null default now(),
  primary key (finding_id, auditor_id)
);

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('question', 'answer', 'project', 'comment', 'profile', 'griot_query', 'message', 'audit_finding'));

-- ============================================================
-- Droits d'accès
-- ============================================================
create or replace function public.is_audit_party(p_audit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from audits where id = p_audit and owner_id = auth.uid())
      or exists (select 1 from audit_auditors where audit_id = p_audit and auditor_id = auth.uid())
      or is_moderator();
$$;

create or replace function public.can_read_audit_findings(p_audit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from audits where id = p_audit and confidentiality = 'public') or is_audit_party(p_audit);
$$;

-- ============================================================
-- Déroulé de l'audit
-- ============================================================
-- Le forfait est bloqué dès la création
create or replace function public.create_audit(
  p_title text, p_repo_url text, p_context text, p_confidentiality text, p_max_auditors integer, p_fee bigint, p_days integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_min bigint := (select value::bigint from app_settings where key = 'audit_min_fee');
begin
  if p_fee < v_min then raise exception 'Forfait minimum : % FCFA', v_min; end if;
  if p_repo_url !~ '^https://github\.com/[^/]+/[^/]+' then raise exception 'Indique l''URL d''un dépôt GitHub'; end if;
  insert into audits (owner_id, title, repo_url, context, confidentiality, max_auditors, fee, deadline)
  values (auth.uid(), trim(p_title), trim(p_repo_url), trim(p_context), p_confidentiality, p_max_auditors, p_fee,
          now() + make_interval(days => greatest(3, least(p_days, 30))))
  returning id into v_id;
  perform wallet_move(auth.uid(), -p_fee, 'audit_payment', 'audit', v_id);
  return v_id;
end $$;

-- Rejoindre comme auditeur : niveau Expert et accord de confidentialité
create or replace function public.join_audit(p_audit uuid, p_accept_nda boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a audits%rowtype; v_xp integer; v_min integer := (select value::int from app_settings where key = 'audit_min_xp');
begin
  select * into a from audits where id = p_audit for update;
  if a.id is null or a.status not in ('open', 'in_progress') then raise exception 'Audit fermé'; end if;
  if a.owner_id = auth.uid() then raise exception 'On n''audite pas son propre code'; end if;
  select xp into v_xp from profiles where id = auth.uid();
  if coalesce(v_xp, 0) < v_min then raise exception 'Réservé aux auditeurs de niveau Expert (% XP)', v_min; end if;
  if not p_accept_nda then raise exception 'Accepte l''accord de confidentialité pour accéder au code'; end if;
  if (select count(*) from audit_auditors where audit_id = p_audit) >= a.max_auditors then
    raise exception 'Cet audit a déjà ses % auditeurs', a.max_auditors;
  end if;
  insert into audit_auditors (audit_id, auditor_id, nda_accepted_at) values (p_audit, auth.uid(), now())
  on conflict do nothing;
  insert into notifications (user_id, kind, payload)
  values (a.owner_id, 'audit_auditor_joined', jsonb_build_object('audit_id', p_audit, 'title', a.title));
end $$;

create or replace function public.add_audit_finding(
  p_audit uuid, p_category text, p_severity text, p_title text, p_description text, p_fix text, p_file text, p_effort numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; a audits%rowtype;
begin
  select * into a from audits where id = p_audit;
  if a.status not in ('open', 'in_progress') then raise exception 'Audit fermé'; end if;
  if not exists (select 1 from audit_auditors where audit_id = p_audit and auditor_id = auth.uid()) then
    raise exception 'Seuls les auditeurs de cet audit ajoutent des constats';
  end if;
  insert into audit_findings (audit_id, auditor_id, source, category, severity, title, description, fix, file_path, effort_hours)
  values (p_audit, auth.uid(), 'auditor', p_category, p_severity, trim(p_title), trim(p_description),
          nullif(trim(p_fix), ''), nullif(trim(p_file), ''), greatest(coalesce(p_effort, 1), 0.5))
  returning id into v_id;
  update audits set status = 'in_progress' where id = p_audit and status = 'open';
  return v_id;
end $$;

-- Confrontation : le porteur conteste un constat
create or replace function public.contest_finding(p_finding uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare f audit_findings%rowtype; a audits%rowtype;
begin
  select * into f from audit_findings where id = p_finding for update;
  select * into a from audits where id = f.audit_id;
  if a.owner_id is distinct from auth.uid() then raise exception 'Seul le porteur conteste un constat'; end if;
  if a.status not in ('open', 'in_progress') then raise exception 'Audit fermé'; end if;
  if f.status <> 'open' then raise exception 'Ce constat a déjà été tranché ou contesté'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Explique pourquoi tu contestes (10 caractères minimum)'; end if;
  update audit_findings set status = 'contested', contest_reason = trim(p_reason) where id = p_finding;
  insert into notifications (user_id, kind, payload)
  select aa.auditor_id, 'audit_contest', jsonb_build_object('audit_id', a.id, 'title', f.title)
  from audit_auditors aa where aa.audit_id = a.id and aa.auditor_id is distinct from f.auditor_id;
end $$;

-- Les autres auditeurs tranchent à la majorité (la modération tranche s'il n'y a pas d'autre auditeur)
create or replace function public.vote_finding(p_finding uuid, p_uphold boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  f audit_findings%rowtype;
  v_voters integer;
  v_yes integer;
  v_no integer;
  v_needed integer;
  v_result text;
begin
  select * into f from audit_findings where id = p_finding for update;
  if f.status <> 'contested' then raise exception 'Aucune contestation en cours'; end if;
  select count(*) into v_voters from audit_auditors
  where audit_id = f.audit_id and auditor_id is distinct from f.auditor_id;

  if v_voters = 0 or (is_moderator() and not exists (
       select 1 from audit_auditors where audit_id = f.audit_id and auditor_id = auth.uid())) then
    if not is_moderator() then raise exception 'La modération tranche ce constat'; end if;
    v_result := case when p_uphold then 'upheld' else 'dismissed' end;
  else
    if f.auditor_id = auth.uid() then raise exception 'L''auteur du constat ne vote pas'; end if;
    if not exists (select 1 from audit_auditors where audit_id = f.audit_id and auditor_id = auth.uid()) then
      raise exception 'Seuls les auditeurs de cet audit votent';
    end if;
    insert into audit_votes (finding_id, auditor_id, uphold) values (p_finding, auth.uid(), p_uphold)
    on conflict (finding_id, auditor_id) do update set uphold = excluded.uphold;
    select count(*) filter (where uphold), count(*) filter (where not uphold) into v_yes, v_no
    from audit_votes where finding_id = p_finding;
    v_needed := v_voters / 2 + 1;
    v_result := case when v_yes >= v_needed then 'upheld' when v_no >= v_needed then 'dismissed' end;
  end if;

  if v_result is not null then update audit_findings set status = v_result where id = p_finding; end if;
  return coalesce(v_result, 'pending');
end $$;

-- Score de dette technique : 100 moins critique 15, moyen 6, mineur 2 (constats maintenus)
create or replace function public.audit_score(p_audit uuid)
returns table (score integer, effort_hours numeric, critiques integer, moyens integer, mineurs integer)
language sql stable security definer set search_path = public as $$
  select greatest(0, 100 - coalesce(sum(case severity when 'critique' then 15 when 'moyen' then 6 else 2 end), 0))::int,
         coalesce(sum(f.effort_hours), 0),
         count(*) filter (where severity = 'critique')::int,
         count(*) filter (where severity = 'moyen')::int,
         count(*) filter (where severity = 'mineur')::int
  from audit_findings f
  where f.audit_id = p_audit and f.status in ('open', 'upheld');
$$;

-- Clôture : rapport final, certificat, paiement des auditeurs (70 % répartis entre ceux qui ont des constats maintenus)
create or replace function public.close_audit(p_audit uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  a audits%rowtype;
  s record;
  v_code text;
  v_pct integer := (select value::int from app_settings where key = 'audit_auditor_share_pct');
  v_pool bigint;
  v_paid bigint := 0;
  v_n integer;
  r record;
begin
  select * into a from audits where id = p_audit for update;
  if a.owner_id is distinct from auth.uid() and not is_moderator() then raise exception 'Seul le porteur clôture son audit'; end if;
  if a.status <> 'in_progress' then raise exception 'Il faut au moins un constat d''auditeur pour clôturer'; end if;
  if exists (select 1 from audit_findings where audit_id = p_audit and status = 'contested') then
    raise exception 'Des contestations sont en cours : attends le vote des auditeurs';
  end if;

  select * into s from audit_score(p_audit);
  v_code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  update audit_findings set status = 'upheld' where audit_id = p_audit and status = 'open';
  update audits set status = 'closed', closed_at = now(), score = s.score, effort_hours = s.effort_hours, certificate_code = v_code
  where id = p_audit;

  v_pool := a.fee * v_pct / 100;
  select count(distinct auditor_id) into v_n from audit_findings
  where audit_id = p_audit and source = 'auditor' and status = 'upheld';
  if v_n > 0 then
    for r in select distinct auditor_id from audit_findings where audit_id = p_audit and source = 'auditor' and status = 'upheld' loop
      perform wallet_move(r.auditor_id, v_pool / v_n, 'audit_payout', 'audit', p_audit);
      update audit_auditors set paid = v_pool / v_n where audit_id = p_audit and auditor_id = r.auditor_id;
      perform add_points(r.auditor_id, 40, 'audit_completed', 'audit', p_audit);
      insert into notifications (user_id, kind, payload)
      values (r.auditor_id, 'audit_paid', jsonb_build_object('audit_id', p_audit, 'amount', v_pool / v_n));
      v_paid := v_paid + v_pool / v_n;
    end loop;
  end if;
  perform wallet_move(null, a.fee - v_paid, 'commission', 'audit', p_audit);
  return v_code;
end $$;

create or replace function public.rate_auditor(p_audit uuid, p_auditor uuid, p_rating integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from audits where id = p_audit and owner_id = auth.uid() and status = 'closed') then
    raise exception 'Note possible une fois l''audit clôturé, par le porteur';
  end if;
  update audit_auditors set rating = p_rating where audit_id = p_audit and auditor_id = p_auditor;
end $$;

-- Audits expirés sans constat d'auditeur : forfait remboursé (tâche quotidienne)
create or replace function public.expire_audits()
returns integer language plpgsql security definer set search_path = public as $$
declare a record; n integer := 0;
begin
  for a in select id, owner_id, fee from audits where status = 'open' and deadline < now() for update loop
    perform wallet_move(a.owner_id, a.fee, 'audit_refund', 'audit', a.id);
    update audits set status = 'refunded', closed_at = now() where id = a.id;
    insert into notifications (user_id, kind, payload)
    values (a.owner_id, 'audit_refunded', jsonb_build_object('audit_id', a.id, 'amount', a.fee));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.expire_audits from public, anon, authenticated;

create or replace function public.cron_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev date := (date_trunc('month', now()) - interval '1 month')::date;
begin
  return jsonb_build_object(
    'expired_bounties', expire_bounties(),
    'clone_pass_payouts', distribute_clone_passes(v_prev),
    'refunded_audits', expire_audits()
  );
end $$;
revoke execute on function public.cron_daily from public, anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.audits enable row level security;
alter table public.audit_auditors enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_votes enable row level security;

-- Les audits (titre, statut, score) sont visibles ; le dépôt, le rapport automatique et les constats
-- d'un audit confidentiel ne le sont que des parties (porteur, auditeurs, modération).
create policy "lecture publique" on public.audits for select using (true);
revoke select on public.audits from anon, authenticated;
grant select (id, owner_id, title, context, confidentiality, max_auditors, fee, status, deadline, score, effort_hours,
              certificate_code, created_at, closed_at) on public.audits to anon, authenticated;

create or replace function public.audit_private_details(p_audit uuid)
returns table (repo_url text, auto_report jsonb)
language sql stable security definer set search_path = public as $$
  select a.repo_url, a.auto_report from audits a
  where a.id = p_audit and (a.confidentiality = 'public' or is_audit_party(a.id));
$$;
create policy "auditeurs visibles" on public.audit_auditors for select using (true);
create policy "constats" on public.audit_findings for select using (public.can_read_audit_findings(audit_id));
create policy "votes" on public.audit_votes for select using (public.is_audit_party(
  (select f.audit_id from public.audit_findings f where f.id = finding_id)));

alter publication supabase_realtime add table public.audit_findings;

-- Modération : un constat signalé (ton irrespectueux, faux) peut être écarté
create or replace function public.moderate_report(p_report_id bigint, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r reports%rowtype; v_author uuid;
begin
  if not is_moderator() then raise exception 'Réservé à la modération'; end if;
  select * into r from reports where id = p_report_id for update;

  if p_action = 'remove' then
    if r.target_type = 'question' then
      delete from questions where id = r.target_id::uuid returning author_id into v_author;
    elsif r.target_type = 'answer' then
      delete from answers where id = r.target_id::uuid returning author_id into v_author;
    elsif r.target_type = 'project' then
      delete from projects where id = r.target_id::uuid returning owner_id into v_author;
    elsif r.target_type = 'comment' then
      delete from comments where id = r.target_id::uuid returning author_id into v_author;
    elsif r.target_type = 'message' then
      update messages set deleted_at = now(), body = '[message supprimé par la modération]'
      where id = r.target_id::bigint returning author_id into v_author;
    elsif r.target_type = 'audit_finding' then
      update audit_findings set status = 'dismissed' where id = r.target_id::uuid returning auditor_id into v_author;
    end if;
    if v_author is not null then
      perform add_points(v_author, -15, 'content_removed', r.target_type, null);
    end if;
    update reports set status = 'actioned', handled_by = auth.uid()
    where target_type = r.target_type and target_id = r.target_id and status = 'open';
  else
    update reports set status = 'dismissed', handled_by = auth.uid() where id = p_report_id;
  end if;
end $$;
