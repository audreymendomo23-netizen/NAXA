-- NAXA 154 — validation atomique des dossiers Promoteur/pharmacie.
-- La validation documentaire reste une attestation d'un administrateur; aucun fichier n'est stocké ici.
create or replace function public.admin_valider_dossier_pharmacie(
  p_pharmacie uuid,
  p_autorisations_verifiees boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := auth.uid();
  v_pharmacie public.pharmacies%rowtype;
  v_link public.promoteur_pharmacies%rowtype;
  v_promoteur public.profiles%rowtype;
  v_convention public.conventions_promoteurs%rowtype;
  v_abonnement public.abonnements_promoteurs%rowtype;
  v_arch public.naxa_architectures%rowtype;
  v_links_count integer;
  v_conventions_count integer;
  v_abonnements_count integer;
  v_fin date := current_date + 14;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'Accès réservé à NAXA' using errcode = '42501';
  end if;
  if p_pharmacie is null or p_autorisations_verifiees is distinct from true then
    raise exception 'Vérification des autorisations obligatoire' using errcode = '22023';
  end if;

  select ph.* into v_pharmacie
  from public.pharmacies ph
  where ph.id = p_pharmacie
  for update;
  if not found then
    raise exception 'Pharmacie introuvable' using errcode = 'P0002';
  end if;

  select count(*) into v_links_count
  from public.promoteur_pharmacies pp
  where pp.pharmacie_id = p_pharmacie;
  if v_links_count <> 1 then
    raise exception 'Rattachement Promoteur/pharmacie absent ou ambigu' using errcode = '23514';
  end if;

  select pp.* into v_link
  from public.promoteur_pharmacies pp
  where pp.pharmacie_id = p_pharmacie
  for update;

  select p.* into v_promoteur
  from public.profiles p
  where p.id = v_link.promoteur_id
  for update;
  if not found or v_promoteur.role::text <> 'promoteur' or v_promoteur.architecture_code is null then
    raise exception 'Compte Promoteur ou architecture invalide' using errcode = '23514';
  end if;

  select count(*) into v_conventions_count
  from public.conventions_promoteurs c
  where c.promoteur_id = v_promoteur.id;
  select count(*) into v_abonnements_count
  from public.abonnements_promoteurs a
  where a.promoteur_id = v_promoteur.id;
  if v_conventions_count <> 1 or v_abonnements_count <> 1 then
    raise exception 'Convention ou abonnement absent ou ambigu' using errcode = '23514';
  end if;

  select c.* into v_convention
  from public.conventions_promoteurs c
  where c.promoteur_id = v_promoteur.id
  for update;
  select a.* into v_abonnement
  from public.abonnements_promoteurs a
  where a.promoteur_id = v_promoteur.id
  for update;

  select a.* into v_arch
  from public.naxa_architectures a
  where a.code = v_promoteur.architecture_code and a.active = true;
  if not found
     or v_convention.architecture_code is distinct from v_promoteur.architecture_code
     or v_abonnement.convention_id is distinct from v_convention.id
     or v_abonnement.montant_mensuel is distinct from v_convention.montant_mensuel then
    raise exception 'Convention, abonnement et architecture incohérents' using errcode = '23514';
  end if;

  if v_pharmacie.actif and v_pharmacie.visible_recherche and v_link.actif and v_promoteur.actif then
    raise exception 'Dossier déjà actif' using errcode = 'P0001';
  end if;

  -- Les dates de l'essai commencent à la validation, jamais à la création du dossier.
  update public.conventions_promoteurs
  set statut = 'active', date_expiration = v_fin, updated_at = now()
  where id = v_convention.id;

  update public.abonnements_promoteurs
  set statut = 'actif', debut = current_date, echeance = v_fin, bloque_le = null
  where id = v_abonnement.id;

  insert into public.pharmacie_architectures(
    pharmacie_id, architecture_code, assigned_by, active, max_responsables, max_caisses
  ) values (
    p_pharmacie, v_arch.code, v_admin, true, coalesce(v_arch.max_responsables, 0), v_arch.max_caisses
  )
  on conflict (pharmacie_id) do update set
    architecture_code = excluded.architecture_code,
    assigned_by = excluded.assigned_by,
    active = true,
    max_responsables = excluded.max_responsables,
    max_caisses = excluded.max_caisses;

  update public.profiles
  set actif = true, pharmacie_id = p_pharmacie, architecture_code = v_arch.code
  where id = v_promoteur.id and role::text = 'promoteur';

  update public.promoteur_pharmacies
  set actif = true
  where promoteur_id = v_promoteur.id and pharmacie_id = p_pharmacie;

  -- Provisionnement des privilèges dans la même transaction : toute erreur annule la validation.
  perform public.naxa_provision_promoteur_pharmacie(v_promoteur.id, p_pharmacie);

  -- Dernières écritures : la pharmacie ne devient publiquement visible qu'après les contrôles.
  update public.pharmacies
  set actif = true, visible_recherche = true
  where id = p_pharmacie;
end
$function$;

revoke all on function public.admin_valider_dossier_pharmacie(uuid, boolean) from public, anon;
grant execute on function public.admin_valider_dossier_pharmacie(uuid, boolean) to authenticated;
