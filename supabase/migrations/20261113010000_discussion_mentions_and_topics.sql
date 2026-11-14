alter table public.conversations
  add column images text[] not null default '{}';

alter table public.conversations
  drop constraint if exists conversations_check, -- nom généré par Postgres pour la contrainte de titre
  drop constraint if exists conversations_title_check,
  add constraint conversations_title_check
    check (kind = 'direct' or char_length(title) between 3 and 200);

-- create_topic : la version de main (sujets programmés, 20261111000000_retours.sql) est conservée.

create or replace function public.after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv conversations%rowtype;
  v_author text;
begin
  update conversations
  set last_message_at = new.created_at, messages_count = messages_count + 1
  where id = new.conversation_id
  returning * into v_conv;

  update conversation_members
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.author_id;

  select username into v_author from profiles where id = new.author_id;

  if v_conv.kind = 'direct' then
    insert into notifications (user_id, kind, payload)
    select other.user_id, 'direct_message',
      jsonb_build_object('conversation_id', new.conversation_id, 'from', v_author, 'excerpt', left(new.body, 120))
    from conversation_members other
    where other.conversation_id = new.conversation_id
      and other.user_id <> new.author_id
      and not exists (
        select 1
        from notifications notification
        where notification.user_id = other.user_id
          and notification.kind = 'direct_message'
          and notification.read_at is null
          and notification.payload ->> 'conversation_id' = new.conversation_id::text
      );
  else
    insert into notifications (user_id, kind, payload)
    select distinct profile.id, 'mention',
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'from', v_author,
        'title', v_conv.title,
        'excerpt', left(new.body, 120)
      )
    from regexp_matches(lower(new.body), '@([a-z0-9_]+)', 'g') match
    join profiles profile on lower(profile.username) = match[1]
    where profile.id <> new.author_id;
  end if;

  return new;
end
$$;
