create or replace function public.create_clone(
  p_name text,
  p_specialty text,
  p_description text,
  p_style text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_xp integer;
  v_min integer := (select value::int from app_settings where key = 'clone_min_xp');
begin
  select xp into v_xp from profiles where id = auth.uid();
  if coalesce(v_xp, 0) < v_min then
    raise exception 'Le clone IA est réservé aux devs de niveau Expert (% XP)', v_min;
  end if;
  insert into ai_clones (owner_id, name, specialty, description, style_notes)
  values (auth.uid(), trim(p_name), trim(p_specialty), nullif(trim(p_description), ''), nullif(trim(p_style), ''))
  returning id into v_id;
  return v_id;
end
$$;

revoke execute on function public.create_clone(text, text, text, text) from public, anon;
grant execute on function public.create_clone(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
