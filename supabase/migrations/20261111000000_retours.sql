-- Retours du 11/11/2026 : sujets programmés et invitations, validation des appels d'offres du Radar,
-- accord de confidentialité signé (Forensic), photo de profil professionnelle.

-- ============================================================
-- Discussions : sujets instantanés ou programmés, invitation de ses relations
-- ============================================================
alter table public.conversations add column scheduled_at timestamptz; -- null : sujet instantané
alter table public.conversations add column start_notified boolean not null default false;

-- Mes relations : devs avec qui j'ai une conversation privée, ou membres d'une même Squad
create or replace function public.my_relations()
returns table (id uuid, username text, full_name text, avatar_url text, city text, via text)
language sql stable security definer set search_path = public as $$
  with direct as (
    select o.user_id, max(c.last_message_at) as at, 'messages privés'::text as via
    from conversation_members me
    join conversations c on c.id = me.conversation_id and c.kind = 'direct'
    join conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
    where me.user_id = auth.uid()
    group by o.user_id
  ), squad as (
    select o.user_id, max(o.joined_at) as at, 'Squad ' || min(sq.name) as via
    from squads sq
    left join squad_members me on me.squad_id = sq.id and me.user_id = auth.uid() and me.status = 'member'
    join (
      select sm.squad_id, sm.user_id, sm.joined_at from squad_members sm where sm.status = 'member'
      union all
      select s2.id, s2.owner_id, s2.created_at from squads s2
    ) o on o.squad_id = sq.id and o.user_id <> auth.uid()
    where sq.owner_id = auth.uid() or me.user_id is not null
    group by o.user_id
  ), merged as (
    select user_id, max(at) as at, min(via) as via from (select * from direct union all select * from squad) x group by user_id
  )
  select p.id, p.username, p.full_name, p.avatar_url, p.city, m.via
  from merged m join profiles p on p.id = m.user_id
  where not exists (select 1 from user_blocks b where b.blocker_id = p.id and b.blocked_id = auth.uid())
  order by m.at desc nulls last
  limit 100;
$$;

drop function public.create_topic(text, text, text[]);
create or replace function public.create_topic(p_title text, p_description text, p_tags text[], p_scheduled_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '5 minutes' then
    raise exception 'La date du sujet programmé est déjà passée';
  end if;
  insert into conversations (kind, title, description, tags, created_by, scheduled_at, start_notified)
  values ('topic', trim(p_title), nullif(trim(p_description), ''), coalesce(p_tags[1:5], '{}'), auth.uid(),
          case when p_scheduled_at > now() then p_scheduled_at end, p_scheduled_at is null or p_scheduled_at <= now())
  returning id into v_id;
  insert into conversation_members (conversation_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- Invitation : tout membre du sujet peut y ajouter ses relations ; chacune est notifiée
create or replace function public.invite_to_topic(p_conversation uuid, p_users uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; v_from text; v_n integer;
begin
  select * into c from conversations where id = p_conversation;
  if c.id is null or c.kind <> 'topic' then raise exception 'Sujet introuvable'; end if;
  if not is_conversation_member(p_conversation) then raise exception 'Rejoins le sujet pour y inviter des devs'; end if;
  select username into v_from from profiles where id = auth.uid();

  with invited as (
    insert into conversation_members (conversation_id, user_id)
    select p_conversation, u from unnest(p_users[1:50]) u
    where u <> auth.uid()
      and exists (select 1 from profiles where id = u)
      and not exists (select 1 from user_blocks b where b.blocker_id = u and b.blocked_id = auth.uid())
    on conflict do nothing
    returning user_id
  )
  insert into notifications (user_id, kind, payload)
  select i.user_id, 'topic_invite',
         jsonb_build_object('conversation_id', c.id, 'title', c.title, 'from', v_from, 'scheduled_at', c.scheduled_at)
  from invited i;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Un sujet programmé n'est ouvert aux messages qu'à son heure (son créateur peut le préparer)
create or replace function public.before_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text; v_scheduled timestamptz; v_owner uuid; v_recent integer;
begin
  select kind, scheduled_at, created_by into v_kind, v_scheduled, v_owner from conversations where id = new.conversation_id;
  if v_kind = 'topic' then
    if v_scheduled > now() and new.author_id is distinct from v_owner then
      raise exception 'Ce sujet ouvre le %', to_char(v_scheduled at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY à HH24:MI');
    end if;
    insert into conversation_members (conversation_id, user_id) values (new.conversation_id, new.author_id)
    on conflict do nothing;
  elsif not exists (select 1 from conversation_members where conversation_id = new.conversation_id and user_id = new.author_id) then
    raise exception 'Tu ne participes pas à cette conversation';
  elsif exists (
    select 1 from conversation_members o join user_blocks b on b.blocker_id = o.user_id and b.blocked_id = new.author_id
    where o.conversation_id = new.conversation_id and o.user_id <> new.author_id
  ) then
    raise exception 'Ce dev ne reçoit pas tes messages';
  end if;

  select count(*) into v_recent from messages where author_id = new.author_id and created_at > now() - interval '1 minute';
  if v_recent >= 20 then raise exception 'Doucement : 20 messages par minute maximum'; end if;
  return new;
end $$;

-- À l'heure dite, les membres d'un sujet programmé sont prévenus (appelé par la tâche planifiée et à l'ouverture des pages)
create or replace function public.start_scheduled_topics()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  with due as (
    update conversations set start_notified = true
    where kind = 'topic' and not start_notified and scheduled_at <= now()
    returning id, title, created_by
  )
  insert into notifications (user_id, kind, payload)
  select cm.user_id, 'topic_started', jsonb_build_object('conversation_id', d.id, 'title', d.title)
  from due d join conversation_members cm on cm.conversation_id = d.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.start_scheduled_topics from public, anon, authenticated;

-- ============================================================
-- Radar : les appels d'offres passent par l'administration avant d'être publics
-- ============================================================
alter table public.opportunities drop constraint opportunities_status_check;
alter table public.opportunities add constraint opportunities_status_check
  check (status in ('draft', 'pending', 'open', 'closed', 'rejected'));
alter table public.opportunities add column reviewed_by uuid references public.profiles (id) on delete set null;
alter table public.opportunities add column reviewed_at timestamptz;
alter table public.opportunities add column review_note text;
create index on public.opportunities (status, deadline);

drop policy "ouvertes ou les miennes" on public.opportunities;
create policy "validées ou les miennes" on public.opportunities for select
  using (status in ('open', 'closed') or publisher_id = auth.uid() or public.is_moderator());

-- Seule l'administration ouvre une opportunité au public (la collecte passe par le service, sans utilisateur)
create or replace function public.guard_opportunity_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_moderator() then
    if new.status = 'open' and old.status is distinct from 'open' then
      raise exception 'Une opportunité est publiée après validation par l''administration';
    end if;
    if new.status not in ('draft', 'pending', 'closed') and new.status is distinct from old.status then
      raise exception 'Statut non autorisé';
    end if;
  end if;
  return new;
end $$;
create trigger opportunities_guard_status before update on public.opportunities
  for each row execute function public.guard_opportunity_status();

create or replace function public.review_opportunity(p_opportunity uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare o opportunities%rowtype;
begin
  if not is_moderator() then raise exception 'Réservé à l''administration'; end if;
  select * into o from opportunities where id = p_opportunity for update;
  if o.status <> 'pending' then raise exception 'Cette opportunité n''attend pas de validation'; end if;
  update opportunities
  set status = case when p_approve then 'open' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
  where id = p_opportunity;
  if o.publisher_id is not null then
    insert into notifications (user_id, kind, payload)
    values (o.publisher_id, 'opportunity_reviewed',
            jsonb_build_object('opportunity_id', o.id, 'title', o.title, 'approved', p_approve, 'note', nullif(trim(p_note), '')));
  end if;
end $$;

-- Mes opportunités : uniquement celles validées et encore ouvertes
create or replace function public.my_opportunities()
returns table (opportunity_id uuid, score integer, reasons text[], via_squad text)
language sql stable security definer set search_path = public as $$
  select distinct on (m.opportunity_id) m.opportunity_id, m.score, m.reasons,
         case when m.target_type = 'squad' then sq.name end
  from opportunity_matches m
  join opportunities o on o.id = m.opportunity_id and o.status = 'open' and (o.deadline is null or o.deadline >= current_date)
  left join squads sq on m.target_type = 'squad' and sq.id = m.target_id
  where (m.target_type = 'user' and m.target_id = auth.uid())
     or (m.target_type = 'squad' and (sq.owner_id = auth.uid()
         or exists (select 1 from squad_members sm where sm.squad_id = sq.id and sm.user_id = auth.uid() and sm.status = 'member')))
  order by m.opportunity_id, m.score desc;
$$;

-- Échéance passée : l'opportunité se ferme d'elle-même
create or replace function public.close_expired_opportunities()
returns integer language sql security definer set search_path = public as $$
  with closed as (
    update opportunities set status = 'closed' where status = 'open' and deadline < current_date returning 1
  ) select count(*)::int from closed;
$$;
revoke execute on function public.close_expired_opportunities from public, anon, authenticated;

-- Mise à jour en direct de la liste (nouvelle validation, clôture)
alter publication supabase_realtime add table public.opportunities;

-- ============================================================
-- Forensic : accord de confidentialité signé par l'auditeur
-- ============================================================
alter table public.audit_auditors add column nda_signed_name text;
alter table public.audit_auditors add column nda_version text;
alter table public.audit_auditors add column nda_hash text; -- empreinte SHA-256 de l'accord signé

drop function public.join_audit(uuid, boolean);
create or replace function public.join_audit(p_audit uuid, p_accept_nda boolean, p_signed_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a audits%rowtype; v_xp integer; v_min integer := (select value::int from app_settings where key = 'audit_min_xp');
  v_now timestamptz := now(); v_name text := trim(coalesce(p_signed_name, ''));
begin
  select * into a from audits where id = p_audit for update;
  if a.id is null or a.status not in ('open', 'in_progress') then raise exception 'Audit fermé'; end if;
  if a.owner_id = auth.uid() then raise exception 'On n''audite pas son propre code'; end if;
  select xp into v_xp from profiles where id = auth.uid();
  if coalesce(v_xp, 0) < v_min then raise exception 'Réservé aux auditeurs de niveau Expert (% XP)', v_min; end if;
  if not p_accept_nda then raise exception 'Accepte l''accord de confidentialité pour accéder au code'; end if;
  if char_length(v_name) < 3 then raise exception 'Signe l''accord en saisissant ton nom complet'; end if;
  if (select count(*) from audit_auditors where audit_id = p_audit) >= a.max_auditors then
    raise exception 'Cet audit a déjà ses % auditeurs', a.max_auditors;
  end if;
  insert into audit_auditors (audit_id, auditor_id, nda_accepted_at, nda_signed_name, nda_version, nda_hash)
  values (p_audit, auth.uid(), v_now, v_name, 'nda-2026-11',
          encode(sha256(convert_to(concat_ws('|', 'nda-2026-11', p_audit, a.owner_id, auth.uid(), v_name, v_now), 'UTF8')), 'hex'))
  on conflict do nothing;
  if not found then return; end if;

  -- Les deux parties reçoivent l'accord signé (PDF)
  insert into notifications (user_id, kind, payload)
  values (a.owner_id, 'audit_auditor_joined', jsonb_build_object('audit_id', p_audit, 'title', a.title)),
         (a.owner_id, 'audit_nda_signed', jsonb_build_object('audit_id', p_audit, 'title', a.title, 'auditor_id', auth.uid(), 'signed_by', v_name)),
         (auth.uid(), 'audit_nda_signed', jsonb_build_object('audit_id', p_audit, 'title', a.title, 'auditor_id', auth.uid(), 'signed_by', v_name));
end $$;

-- ============================================================
-- Photo de profil professionnelle
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 512000, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "déposer sa photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "remplacer sa photo" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "supprimer sa photo" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lire les photos" on storage.objects for select using (bucket_id = 'avatars');

-- ============================================================
-- Vocabulaire : « collaborateur » plutôt que « contributeur » (projets et Squads)
-- ============================================================
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
            '{Collaborateur}', p.stack, 'recruiting')
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
update public.squads set roles_needed = array_replace(roles_needed, 'Contributeur', 'Collaborateur');
