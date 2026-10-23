-- NAXA 228 — sérialiser les grants concurrents pour un même compte cible.
-- Empêche deux Promoteurs de contourner le contrôle de chevauchement par une course.
begin;

create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target = v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if p_fonction not in ('caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable') then
    raise exception 'Fonction non autorisée'; end if;
  if p_commence_at is null or p_expire_at is null or p_expire_at <= p_commence_at
     or p_expire_at <= now() then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;

  -- Le verrou de ligne est pris avant de vérifier le chevauchement :
  -- deux grants sur la même personne ne peuvent pas franchir ce test simultanément.
  select * into v_profile
  from public.profiles
  where id = p_target and actif = true
  for update;
  if not found then raise exception 'Le compte cible doit être actif'; end if;

  if not exists (
    select 1 from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id = p.id
    join public.pharmacies ph on ph.id = pp.pharmacie_id
    where p.id = v_actor and p.role::text = 'promoteur' and p.actif = true
      and pp.pharmacie_id = p_pharmacie and pp.actif = true and ph.actif = true
  ) then raise exception 'Pharmacie hors réseau Promoteur ou inactive'; end if;

  if not public.naxa_can('ASSIGN_USER_TO_PHARMACY', p_pharmacie, p_target) then
    raise exception 'Permission ASSIGN_USER_TO_PHARMACY refusée';
  end if;

  -- Les périodes sont semi-ouvertes [début, expiration) : deux périodes
  -- qui se touchent exactement ne se chevauchent pas.
  if exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id = p_target and a.pharmacie_id = p_pharmacie
      and a.fonction = p_fonction and a.statut = 'active'
      and a.commence_at < p_expire_at and a.expire_at > p_commence_at
  ) then raise exception 'Une affectation de cette fonction chevauche déjà la période'; end if;

  insert into public.naxa_professional_assignments(
    profile_id, pharmacie_id, fonction, statut, motif, commence_at, expire_at, accorde_par
  ) values (
    p_target, p_pharmacie, p_fonction, 'active', trim(p_motif), p_commence_at, p_expire_at, v_actor
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

commit;
