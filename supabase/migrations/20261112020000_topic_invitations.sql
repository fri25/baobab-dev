create table public.topic_invitations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  scheduled_at timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check (invitee_id <> invited_by)
);
create unique index topic_invitations_one_pending
  on public.topic_invitations (conversation_id, invitee_id)
  where delivered_at is null;
create index topic_invitations_due on public.topic_invitations (scheduled_at)
  where delivered_at is null;

alter table public.topic_invitations enable row level security;
revoke all on public.topic_invitations from anon, authenticated;
grant select on public.topic_invitations to authenticated;
create policy "voir ses invitations programmées" on public.topic_invitations for select to authenticated
  using (invited_by = auth.uid() and delivered_at is null);

create or replace function public.invite_to_topic(p_conversation uuid, p_username text, p_scheduled_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_invitee uuid;
  v_title text;
  v_id uuid;
  v_added uuid;
begin
  if v_me is null then raise exception 'Connexion requise'; end if;
  select title into v_title from conversations where id = p_conversation and kind = 'topic';
  if not found then raise exception 'Sujet introuvable'; end if;
  if not is_conversation_member(p_conversation) then raise exception 'Rejoins le sujet avant d''inviter quelqu''un'; end if;
  if p_scheduled_at is not null and p_scheduled_at <= now() then raise exception 'Choisis une date future'; end if;

  select id into v_invitee
  from profiles where username = lower(trim(coalesce(p_username, '')));
  if not found then raise exception 'Aucun membre ne correspond à ce pseudo'; end if;
  if v_invitee = v_me then raise exception 'Tu participes déjà au sujet'; end if;
  if exists (select 1 from conversation_members where conversation_id = p_conversation and user_id = v_invitee) then
    raise exception 'Ce membre participe déjà au sujet';
  end if;

  insert into topic_invitations (conversation_id, invitee_id, invited_by, scheduled_at)
  values (p_conversation, v_invitee, v_me, coalesce(p_scheduled_at, now()))
  returning id into v_id;

  if p_scheduled_at is null then
    insert into conversation_members (conversation_id, user_id)
    values (p_conversation, v_invitee)
    on conflict do nothing
    returning user_id into v_added;
    update topic_invitations set delivered_at = now() where id = v_id;
    if v_added is not null then
      insert into notifications (user_id, kind, payload)
      values (
        v_invitee,
        'topic_invitation',
        jsonb_build_object('conversation_id', p_conversation, 'title', v_title, 'from', (select username from profiles where id = v_me))
      );
    end if;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'Une invitation est déjà programmée pour ce membre';
end $$;
revoke execute on function public.invite_to_topic(uuid, text, timestamptz) from public, anon;
grant execute on function public.invite_to_topic(uuid, text, timestamptz) to authenticated;

create or replace function public.cancel_topic_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from topic_invitations where id = p_invitation and invited_by = auth.uid() and delivered_at is null;
  if not found then raise exception 'Invitation programmée introuvable ou déjà envoyée'; end if;
end $$;
revoke execute on function public.cancel_topic_invitation(uuid) from public, anon;
grant execute on function public.cancel_topic_invitation(uuid) to authenticated;

create or replace function public.dispatch_topic_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_invite record;
  v_added uuid;
  v_count integer := 0;
begin
  for v_invite in
    select ti.id, ti.conversation_id, ti.invitee_id, ti.invited_by, c.title
    from topic_invitations ti
    join conversations c on c.id = ti.conversation_id and c.kind = 'topic'
    where ti.delivered_at is null and ti.scheduled_at <= now()
    order by ti.scheduled_at
    for update of ti skip locked
  loop
    update topic_invitations set delivered_at = now() where id = v_invite.id;
    insert into conversation_members (conversation_id, user_id)
    values (v_invite.conversation_id, v_invite.invitee_id)
    on conflict do nothing
    returning user_id into v_added;

    if v_added is not null then
      insert into notifications (user_id, kind, payload)
      values (
        v_invite.invitee_id,
        'topic_invitation',
        jsonb_build_object(
          'conversation_id', v_invite.conversation_id,
          'title', v_invite.title,
          'from', (select username from profiles where id = v_invite.invited_by)
        )
      );
    end if;
    v_added := null;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke execute on function public.dispatch_topic_invitations() from public, anon, authenticated;
grant execute on function public.dispatch_topic_invitations() to service_role;
