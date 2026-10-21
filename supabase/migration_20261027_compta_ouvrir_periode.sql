-- NAXA Comptable — ouverture atomique d'une période sans chevauchement.
begin;

create or replace function public.compta_ouvrir_periode(
  p_pharmacie uuid,
  p_date_debut date,
  p_date_fin date,
  p_acteur uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $ouvrir$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Ouverture de période réservée au service serveur' using errcode = '42501';
  end if;
  if p_pharmacie is null or p_acteur is null or p_date_debut is null or p_date_fin is null
     or p_date_fin < p_date_debut then
    raise exception 'Pharmacie, acteur et période valide obligatoires';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_acteur and p.actif is true and p.pharmacie_id = p_pharmacie
  ) then
    raise exception 'Acteur inactif ou hors du périmètre de la pharmacie' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pharmacie::text, 0));

  if exists (
    select 1 from public.compta_periodes p
    where p.pharmacie_id = p_pharmacie
      and p.date_debut <= p_date_fin
      and p.date_fin >= p_date_debut
  ) then
    raise exception 'Ouverture refusée : la période chevauche une période existante';
  end if;

  insert into public.compta_periodes(pharmacie_id, date_debut, date_fin, statut)
  values (p_pharmacie, p_date_debut, p_date_fin, 'ouverte')
  returning id into v_id;

  perform public.compta_auditer(
    p_pharmacie, p_acteur, 'periode_comptable_ouverte',
    'periode', v_id::text, 'succes',
    'debut=' || p_date_debut::text || '; fin=' || p_date_fin::text
  );
  return v_id;
end;
$ouvrir$;

revoke all on function public.compta_ouvrir_periode(uuid,date,date,uuid) from public, anon, authenticated;
grant execute on function public.compta_ouvrir_periode(uuid,date,date,uuid) to service_role;

commit;
