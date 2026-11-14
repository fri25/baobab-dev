alter table public.opportunities
  drop constraint opportunities_status_check,
  add column moderation_note text,
  add constraint opportunities_status_check
    check (status in ('draft', 'pending_review', 'open', 'closed', 'rejected'));

update public.opportunities
set status = 'pending_review'
where status = 'open';

drop policy "ouvertes ou les miennes" on public.opportunities;
create policy "opportunités publiques, personnelles ou modérées" on public.opportunities for select
  using (status in ('open', 'closed') or publisher_id = auth.uid() or public.is_moderator());

drop policy "modifier la mienne" on public.opportunities;
create policy "modifier son brouillon ou son annonce refusée" on public.opportunities for update
  using (
    (publisher_id = auth.uid() and status in ('draft', 'rejected'))
    or public.is_moderator()
  )
  with check (
    (publisher_id = auth.uid() and status in ('draft', 'rejected'))
    or public.is_moderator()
  );

revoke update (status) on public.opportunities from authenticated;

create or replace function public.submit_opportunity_for_review(p_opportunity uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update opportunities
  set status = 'pending_review', moderation_note = null
  where id = p_opportunity and publisher_id = auth.uid() and status in ('draft', 'rejected');
  if not found then raise exception 'Brouillon introuvable ou déjà soumis'; end if;
end $$;
revoke execute on function public.submit_opportunity_for_review(uuid) from public, anon;
grant execute on function public.submit_opportunity_for_review(uuid) to authenticated;

create or replace function public.moderate_opportunity(p_opportunity uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o opportunities%rowtype;
begin
  if not is_moderator() then raise exception 'Réservé à la modération'; end if;
  select * into o from opportunities where id = p_opportunity for update;
  if not found or o.status <> 'pending_review' then raise exception 'Opportunité en attente introuvable'; end if;

  if p_action = 'approve' then
    update opportunities set status = 'open', moderation_note = null where id = p_opportunity;
  elsif p_action = 'reject' then
    if char_length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Indique le motif du refus (5 caractères minimum)'; end if;
    update opportunities set status = 'rejected', moderation_note = trim(p_note) where id = p_opportunity;
  else
    raise exception 'Décision invalide';
  end if;
end $$;
revoke execute on function public.moderate_opportunity(uuid, text, text) from public, anon;
grant execute on function public.moderate_opportunity(uuid, text, text) to authenticated;

create or replace function public.close_opportunity(p_opportunity uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update opportunities set status = 'closed'
  where id = p_opportunity and publisher_id = auth.uid() and status = 'open';
  if not found then raise exception 'Opportunité ouverte introuvable'; end if;
end $$;
revoke execute on function public.close_opportunity(uuid) from public, anon;
grant execute on function public.close_opportunity(uuid) to authenticated;

create table public.opportunity_deadline_reminders (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  deadline date not null,
  days_before integer not null check (days_before in (1, 3, 7)),
  created_at timestamptz not null default now(),
  primary key (opportunity_id, user_id, deadline, days_before)
);
alter table public.opportunity_deadline_reminders enable row level security;
revoke all on public.opportunity_deadline_reminders from public, anon, authenticated;

create or replace function public.process_opportunity_deadlines()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_closed integer;
  v_reminders integer;
  v_today date := (now() at time zone 'Africa/Porto-Novo')::date;
begin
  update opportunities
  set status = 'closed'
  where status = 'open' and deadline < v_today;
  get diagnostics v_closed = row_count;

  with targets as (
    select m.opportunity_id, m.target_id as user_id
    from opportunity_matches m
    where m.target_type = 'user' and m.score >= 50
    union
    select m.opportunity_id, sq.owner_id
    from opportunity_matches m
    join squads sq on sq.id = m.target_id
    where m.target_type = 'squad' and m.score >= 50
    union
    select m.opportunity_id, sm.user_id
    from opportunity_matches m
    join squad_members sm on sm.squad_id = m.target_id and sm.status = 'member'
    where m.target_type = 'squad' and m.score >= 50
  ), due as (
    select distinct o.id as opportunity_id, t.user_id, o.deadline,
      (o.deadline - v_today)::integer as days_before
    from opportunities o
    join targets t on t.opportunity_id = o.id
    where o.status = 'open'
      and o.deadline - v_today in (1, 3, 7)
  ), inserted as (
    insert into opportunity_deadline_reminders (opportunity_id, user_id, deadline, days_before)
    select opportunity_id, user_id, deadline, days_before from due
    on conflict do nothing
    returning opportunity_id, user_id, deadline, days_before
  )
  insert into notifications (user_id, kind, payload)
  select i.user_id, 'opportunity_deadline',
    jsonb_build_object(
      'opportunity_id', i.opportunity_id,
      'title', o.title,
      'deadline', i.deadline,
      'days_before', i.days_before
    )
  from inserted i
  join opportunities o on o.id = i.opportunity_id;
  get diagnostics v_reminders = row_count;

  return jsonb_build_object('closed', v_closed, 'reminders', v_reminders);
end $$;
revoke execute on function public.process_opportunity_deadlines() from public, anon, authenticated;
grant execute on function public.process_opportunity_deadlines() to service_role;

create or replace function public.reject_late_opportunity_response()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from opportunities
    where id = new.opportunity_id
      and deadline < (now() at time zone 'Africa/Porto-Novo')::date
  ) then
    raise exception 'La date limite de cette opportunité est dépassée';
  end if;
  return new;
end $$;
create trigger opportunity_response_deadline
  before insert on public.opportunity_responses
  for each row execute function public.reject_late_opportunity_response();

alter publication supabase_realtime add table public.opportunities;
