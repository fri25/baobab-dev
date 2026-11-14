alter table public.profiles
  add column if not exists programming_languages text[] not null default '{}';

grant update (programming_languages) on public.profiles to authenticated;

with recursive ordered_points as (
  select
    id,
    user_id,
    amount,
    row_number() over (partition by user_id order by id) as row_number
  from public.points_log
),
ledger as (
  select
    id,
    user_id,
    row_number,
    greatest(amount, 0)::bigint as balance_after,
    greatest(amount, 0)::bigint as applied_amount
  from ordered_points
  where row_number = 1

  union all

  select
    next_point.id,
    next_point.user_id,
    next_point.row_number,
    greatest(ledger.balance_after + next_point.amount, 0)::bigint as balance_after,
    (greatest(ledger.balance_after + next_point.amount, 0) - ledger.balance_after)::bigint as applied_amount
  from ledger
  join ordered_points next_point
    on next_point.user_id = ledger.user_id
    and next_point.row_number = ledger.row_number + 1
)
update public.points_log point
set amount = ledger.applied_amount::integer
from ledger
where point.id = ledger.id
  and point.amount <> ledger.applied_amount;

create or replace function public.add_points(
  p_user uuid,
  p_amount integer,
  p_reason text,
  p_ref_type text default null,
  p_ref_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_next integer;
  v_applied integer;
begin
  if p_amount = 0 then return; end if;

  select xp into v_current
  from profiles
  where id = p_user
  for update;
  if not found then raise exception 'Profil introuvable'; end if;

  v_next := greatest(v_current + p_amount, 0);
  v_applied := v_next - v_current;

  insert into points_log (user_id, amount, reason, ref_type, ref_id)
  values (p_user, v_applied, p_reason, p_ref_type, p_ref_id);

  update profiles
  set xp = v_next, updated_at = now()
  where id = p_user;
end
$$;

create or replace function public.profile_xp_breakdown(p_user uuid)
returns table (reason text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select points_log.reason, sum(points_log.amount)::bigint
  from public.points_log
  where points_log.user_id = p_user
  group by points_log.reason;
$$;

revoke execute on function public.profile_xp_breakdown(uuid) from public;
grant execute on function public.profile_xp_breakdown(uuid) to anon, authenticated;
