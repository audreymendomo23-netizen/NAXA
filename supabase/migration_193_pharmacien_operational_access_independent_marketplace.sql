-- NAXA ERP — l'accès opérationnel Pharmacien ne dépend pas de la publication Marketplace.
-- Une pharmacie active mais non visible dans la recherche doit pouvoir traiter ses dossiers internes.
begin;

create or replace function public.pharmacien_service_demarrer(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  p uuid;
  v_id uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select pharmacie_id into p
  from public.profiles
  where id = u and actif = true and fonction_interne = 'pharmacien';
  if p is null then raise exception 'Accès réservé à un compte Pharmacien actif'; end if;
  if not exists (
    select 1 from public.pharmacies f
    where f.id = p and f.actif = true
  ) then raise exception 'La pharmacie est inactive'; end if;

  if exists (
    select 1 from public.pharmacien_service_sessions s
    where s.pharmacien_id = u and s.ended_at is null
  ) then raise exception 'Un service est déjà ouvert pour ce compte'; end if;

  insert into public.pharmacien_service_sessions(pharmacie_id, pharmacien_id, start_note)
  values (p, u, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Un service est déjà ouvert pour ce compte';
end;
$$;

revoke all on function public.pharmacien_service_demarrer(text) from public, anon;
grant execute on function public.pharmacien_service_demarrer(text) to authenticated;

create or replace function public.pharmacien_journaliser_export(
  p_period text,
  p_row_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  p uuid;
  v_id uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if p_period is null or p_period not in ('jour','7jours','30jours','tout') then
    raise exception 'Période de rapport invalide';
  end if;
  if p_row_count is null or p_row_count < 0 or p_row_count > 500 then
    raise exception 'Nombre de lignes exportées invalide';
  end if;
  select pr.pharmacie_id into p
  from public.profiles pr
  join public.pharmacies f on f.id=pr.pharmacie_id and f.actif=true
  where pr.id=u and pr.actif=true and pr.fonction_interne='pharmacien';
  if p is null then raise exception 'Export réservé à un compte Pharmacien actif d’une pharmacie active'; end if;

  insert into public.pharmacien_audit_events(
    pharmacie_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    p, u, 'report', gen_random_uuid(), 'exported',
    jsonb_build_object('period',p_period,'row_count',p_row_count,'format','csv')
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.pharmacien_journaliser_export(text,integer) from public, anon;
grant execute on function public.pharmacien_journaliser_export(text,integer) to authenticated;

comment on function public.pharmacien_service_demarrer(text) is
  'Ouvre un service Pharmacien pour un compte actif d’une pharmacie active, même si la pharmacie n’est pas publiée sur la Marketplace.';
comment on function public.pharmacien_journaliser_export(text,integer) is
  'Journalise un export Pharmacien pour un compte actif d’une pharmacie active; la publication Marketplace n’est pas un prérequis.';
commit;
