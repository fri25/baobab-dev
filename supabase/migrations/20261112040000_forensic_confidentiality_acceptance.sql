alter table public.audits
  add column owner_nda_accepted_at timestamptz,
  add column owner_nda_terms_version text;

alter table public.audit_auditors
  add column nda_terms_version text;

grant select (owner_nda_accepted_at, owner_nda_terms_version) on public.audits to anon, authenticated;

drop function public.create_audit(text, text, text, text, integer, bigint, integer);
create function public.create_audit(
  p_title text,
  p_repo_url text,
  p_context text,
  p_confidentiality text,
  p_max_auditors integer,
  p_fee bigint,
  p_days integer,
  p_accept_nda boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_min bigint := (select value::bigint from app_settings where key = 'audit_min_fee');
begin
  if p_accept_nda is distinct from true then
    raise exception 'Lis et accepte les clauses de confidentialité avant de créer l''audit';
  end if;
  if p_fee < v_min then raise exception 'Forfait minimum : % FCFA', v_min; end if;
  if p_repo_url !~ '^https://github\.com/[^/]+/[^/]+' then raise exception 'Indique l''URL d''un dépôt GitHub'; end if;
  insert into audits (
    owner_id, title, repo_url, context, confidentiality, max_auditors, fee, deadline,
    owner_nda_accepted_at, owner_nda_terms_version
  )
  values (
    auth.uid(), trim(p_title), trim(p_repo_url), trim(p_context), p_confidentiality, p_max_auditors, p_fee,
    now() + make_interval(days => greatest(3, least(p_days, 30))), now(), 'nda-v1'
  )
  returning id into v_id;
  perform wallet_move(auth.uid(), -p_fee, 'audit_payment', 'audit', v_id);
  return v_id;
end $$;
revoke execute on function public.create_audit(text, text, text, text, integer, bigint, integer, boolean) from public, anon;
grant execute on function public.create_audit(text, text, text, text, integer, bigint, integer, boolean) to authenticated;

create or replace function public.join_audit(p_audit uuid, p_accept_nda boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  a audits%rowtype;
  v_xp integer;
  v_min integer := (select value::int from app_settings where key = 'audit_min_xp');
begin
  select * into a from audits where id = p_audit for update;
  if a.id is null or a.status not in ('open', 'in_progress') then raise exception 'Audit fermé'; end if;
  if a.owner_id = auth.uid() then raise exception 'On n''audite pas son propre code'; end if;
  select xp into v_xp from profiles where id = auth.uid();
  if coalesce(v_xp, 0) < v_min then raise exception 'Réservé aux auditeurs de niveau Expert (% XP)', v_min; end if;
  if p_accept_nda is distinct from true then raise exception 'Lis et accepte les clauses de confidentialité pour accéder au code'; end if;
  if (select count(*) from audit_auditors where audit_id = p_audit) >= a.max_auditors then
    raise exception 'Cet audit a déjà ses % auditeurs', a.max_auditors;
  end if;
  insert into audit_auditors (audit_id, auditor_id, nda_accepted_at, nda_terms_version)
  values (p_audit, auth.uid(), now(), 'nda-v1')
  on conflict do nothing;
  insert into notifications (user_id, kind, payload)
  values (a.owner_id, 'audit_auditor_joined', jsonb_build_object('audit_id', p_audit, 'title', a.title));
end $$;
revoke execute on function public.join_audit(uuid, boolean) from public, anon;
grant execute on function public.join_audit(uuid, boolean) to authenticated;
