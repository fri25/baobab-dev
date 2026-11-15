-- Correction automatique des défis (V1) : tests publics et cachés, solutions en JavaScript
-- corrigées côté serveur (src/lib/judge-runner.mjs), meilleur score conservé.

alter table public.challenges
  add column function_name text check (function_name ~ '^[A-Za-z_$][A-Za-z0-9_$]{0,63}$'),
  add column starter_code text check (char_length(starter_code) <= 5000),
  add constraint challenges_auto_function check (grading <> 'auto' or function_name is not null);

-- Jeux de tests. Les tests cachés ne sont visibles que de la modération, puis de tous après clôture.
create table public.challenge_tests (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  position integer not null default 0,
  args jsonb not null check (jsonb_typeof(args) = 'array'),
  expected jsonb not null,
  is_public boolean not null default false
);
create index on public.challenge_tests (challenge_id, position);

alter table public.challenge_tests enable row level security;
create policy "tests visibles" on public.challenge_tests for select using (
  is_public or public.is_moderator()
  or exists (select 1 from public.challenges c where c.id = challenge_id and c.closed_at is not null)
);
create policy "modération gère" on public.challenge_tests for all
  using (public.is_moderator()) with check (public.is_moderator());

-- Nombre de tests (publics et cachés) sans révéler les cachés
create or replace function public.challenge_test_counts(p_challenge_id uuid)
returns table (total integer, public_count integer)
language sql stable security definer set search_path = public as $$
  select count(*)::int, (count(*) filter (where is_public))::int
  from challenge_tests where challenge_id = p_challenge_id;
$$;

-- Participation corrigée automatiquement : le lien de solution devient facultatif
alter table public.challenge_submissions
  alter column solution_url drop not null,
  add column graded_at timestamptz,
  add column auto_report jsonb; -- { passed, total }

-- Seul le serveur (service_role) écrit une participation corrigée automatiquement
drop policy "participer" on public.challenge_submissions;
create policy "participer" on public.challenge_submissions for insert to authenticated
  with check (
    user_id = auth.uid() and score is null and rank is null and graded_at is null and auto_report is null
    and solution_url is not null
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.grading = 'jury' and now() between c.starts_at and c.ends_at
    )
  );

-- Code de la meilleure solution : privé jusqu'à la clôture (auteur et modération seulement)
create table public.challenge_solutions (
  submission_id uuid primary key references public.challenge_submissions (id) on delete cascade,
  code text not null check (char_length(code) <= 20000),
  report jsonb not null,
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now()
);
alter table public.challenge_solutions enable row level security;
create policy "auteur, modération ou défi clos" on public.challenge_solutions for select using (
  exists (
    select 1 from public.challenge_submissions s join public.challenges c on c.id = s.challenge_id
    where s.id = submission_id and (s.user_id = auth.uid() or public.is_moderator() or c.closed_at is not null)
  )
);

-- Départage : à score égal, le premier à l'avoir atteint (graded_at), sinon la date de participation
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
    where challenge_id = p_challenge_id and score is not null and score > 0
    order by score desc, coalesce(graded_at, created_at)
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

drop function public.challenge_leaderboard(uuid, text, text);
create function public.challenge_leaderboard(p_challenge_id uuid, p_scope text default 'all', p_value text default null)
returns table (rank bigint, user_id uuid, username text, full_name text, city text, country text, score numeric, solution_url text, auto_report jsonb)
language sql stable set search_path = public as $$
  select row_number() over (order by s.score desc nulls last, coalesce(s.graded_at, s.created_at)),
         p.id, p.username, p.full_name, p.city, p.country, s.score, s.solution_url, s.auto_report
  from challenge_submissions s join profiles p on p.id = s.user_id
  where s.challenge_id = p_challenge_id
    and case p_scope when 'country' then p.country = p_value when 'city' then p.city = p_value else true end
  order by s.score desc nulls last, coalesce(s.graded_at, s.created_at);
$$;
