-- Discussions : messages privés entre devs et sujets de discussion publics

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'topic')),
  title text check (kind = 'direct' or char_length(title) between 3 and 80),
  description text,
  tags text[] not null default '{}',
  direct_key text unique, -- « uuid_min:uuid_max » : une seule conversation privée par paire
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  messages_count integer not null default 0,
  check ((kind = 'direct') = (direct_key is not null))
);
create index on public.conversations (kind, last_message_at desc);

create table public.conversation_members (
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.conversation_members (user_id);

create table public.messages (
  id bigserial primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  reply_to bigint references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index on public.messages (conversation_id, id desc);

-- Blocage : un dev bloqué ne peut plus écrire en privé
create table public.user_blocks (
  blocker_id uuid references public.profiles (id) on delete cascade,
  blocked_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ============================================================
-- Fonctions
-- ============================================================
create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = p_conversation and user_id = auth.uid());
$$;

create or replace function public.can_read_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations where id = p_conversation and kind = 'topic')
      or is_conversation_member(p_conversation);
$$;

-- Ouvre (ou retrouve) la conversation privée avec un autre dev
create or replace function public.get_or_create_direct(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_me is null then raise exception 'Connexion requise'; end if;
  if p_other = v_me then raise exception 'Impossible de s''écrire à soi-même'; end if;
  if not exists (select 1 from profiles where id = p_other) then raise exception 'Dev introuvable'; end if;
  if exists (select 1 from user_blocks where blocker_id = p_other and blocked_id = v_me) then
    raise exception 'Ce dev ne reçoit pas tes messages';
  end if;

  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);
  select id into v_id from conversations where direct_key = v_key;
  if v_id is null then
    insert into conversations (kind, direct_key, created_by) values ('direct', v_key, v_me) returning id into v_id;
    insert into conversation_members (conversation_id, user_id, role)
    values (v_id, v_me, 'owner'), (v_id, p_other, 'member');
  end if;
  return v_id;
end $$;

-- Crée un sujet public (son créateur en est membre)
create or replace function public.create_topic(p_title text, p_description text, p_tags text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into conversations (kind, title, description, tags, created_by)
  values ('topic', trim(p_title), nullif(trim(p_description), ''), coalesce(p_tags[1:5], '{}'), auth.uid())
  returning id into v_id;
  insert into conversation_members (conversation_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

create or replace function public.join_topic(p_conversation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from conversations where id = p_conversation and kind = 'topic') then
    raise exception 'Sujet introuvable';
  end if;
  insert into conversation_members (conversation_id, user_id) values (p_conversation, auth.uid())
  on conflict do nothing;
end $$;

create or replace function public.leave_topic(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  delete from conversation_members
  where conversation_id = p_conversation and user_id = auth.uid()
    and exists (select 1 from conversations where id = p_conversation and kind = 'topic');
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Liste de mes conversations avec dernier message et non-lus
create or replace function public.my_conversations()
returns table (
  id uuid, kind text, title text, last_message_at timestamptz, unread integer,
  last_body text, last_author text,
  other_id uuid, other_username text, other_full_name text, other_avatar_url text, other_city text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.title, c.last_message_at,
         (select count(*)::int from messages m
          where m.conversation_id = c.id and m.created_at > cm.last_read_at
            and m.author_id <> auth.uid() and m.deleted_at is null),
         lm.body, lp.username,
         op.id, op.username, op.full_name, op.avatar_url, op.city
  from conversation_members cm
  join conversations c on c.id = cm.conversation_id
  left join lateral (
    select m.body, m.author_id from messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.id desc limit 1
  ) lm on true
  left join profiles lp on lp.id = lm.author_id
  left join lateral (
    select p.* from conversation_members o join profiles p on p.id = o.user_id
    where c.kind = 'direct' and o.conversation_id = c.id and o.user_id <> auth.uid() limit 1
  ) op on true
  where cm.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

create or replace function public.unread_conversations_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from conversation_members cm
  where cm.user_id = auth.uid()
    and exists (select 1 from messages m
                where m.conversation_id = cm.conversation_id and m.created_at > cm.last_read_at
                  and m.author_id <> auth.uid() and m.deleted_at is null);
$$;

-- Avant envoi : membre requis (rejoint automatiquement un sujet), anti-spam, blocage
create or replace function public.before_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text; v_recent integer;
begin
  select kind into v_kind from conversations where id = new.conversation_id;
  if v_kind = 'topic' then
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
create trigger messages_before before insert on public.messages
  for each row execute function public.before_message();

-- Après envoi : compteurs, lecture par l'auteur, notifications (privé et @mentions)
create or replace function public.after_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv conversations%rowtype; v_author text;
begin
  update conversations set last_message_at = new.created_at, messages_count = messages_count + 1
  where id = new.conversation_id returning * into v_conv;
  update conversation_members set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.author_id;
  select username into v_author from profiles where id = new.author_id;

  if v_conv.kind = 'direct' then
    -- Une seule notification non lue par conversation, pour ne pas inonder la cloche
    insert into notifications (user_id, kind, payload)
    select o.user_id, 'direct_message',
           jsonb_build_object('conversation_id', new.conversation_id, 'from', v_author, 'excerpt', left(new.body, 120))
    from conversation_members o
    where o.conversation_id = new.conversation_id and o.user_id <> new.author_id
      and not exists (select 1 from notifications n
                      where n.user_id = o.user_id and n.kind = 'direct_message' and n.read_at is null
                        and n.payload ->> 'conversation_id' = new.conversation_id::text);
  else
    insert into notifications (user_id, kind, payload)
    select distinct p.id, 'mention',
           jsonb_build_object('conversation_id', new.conversation_id, 'from', v_author, 'title', v_conv.title, 'excerpt', left(new.body, 120))
    from regexp_matches(new.body, '@([a-z0-9_]+)', 'g') m
    join profiles p on p.username = m[1]
    where p.id <> new.author_id;
  end if;
  return new;
end $$;
create trigger messages_after after insert on public.messages
  for each row execute function public.after_message();

-- Suppression par l'auteur ou la modération : le message reste, son contenu disparaît
create or replace function public.delete_message(p_message_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update messages set deleted_at = now(), body = '[message supprimé]'
  where id = p_message_id and (author_id = auth.uid() or is_moderator()) and deleted_at is null;
  if not found then raise exception 'Message introuvable ou non autorisé'; end if;
end $$;

-- Signalement et modération des messages
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports alter column target_id type text using target_id::text;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('question', 'answer', 'project', 'comment', 'profile', 'griot_query', 'message'));

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

-- ============================================================
-- RLS
-- ============================================================
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;

create policy "sujets publics ou mes conversations" on public.conversations for select
  using (kind = 'topic' or public.is_conversation_member(id));
create policy "le créateur modifie son sujet" on public.conversations for update
  using (kind = 'topic' and (created_by = auth.uid() or public.is_moderator()));
revoke update on public.conversations from authenticated, anon;
grant update (title, description, tags) on public.conversations to authenticated;

create policy "membres visibles" on public.conversation_members for select
  using (user_id = auth.uid() or public.can_read_conversation(conversation_id));

create policy "lire" on public.messages for select using (public.can_read_conversation(conversation_id));
create policy "écrire" on public.messages for insert to authenticated
  with check (author_id = auth.uid() and deleted_at is null and edited_at is null);
create policy "modifier son message" on public.messages for update using (author_id = auth.uid() and deleted_at is null);
revoke update on public.messages from authenticated, anon;
grant update (body, edited_at) on public.messages to authenticated;

create policy "mes blocages" on public.user_blocks for select using (blocker_id = auth.uid());
create policy "bloquer" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "débloquer" on public.user_blocks for delete using (blocker_id = auth.uid());

alter publication supabase_realtime add table public.messages;
