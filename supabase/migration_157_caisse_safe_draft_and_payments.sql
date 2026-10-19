-- NAXA 157 — parcours Caisse : abandon sûr des paniers et paiements non simulés.
-- Additif : aucun déploiement ni changement de données n'est effectué par ce fichier.
begin;

create or replace function public.vente_brouillon_abandonner(p_vente uuid)
returns void
language plpgsql
security definer
set search_path=''
as $abandon$
declare
  v_vente public.ventes%rowtype;
  v_ligne record;
  v_session_statut public.caisse_cloture_statut;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;

  if not found then
    raise exception 'Vente introuvable';
  end if;
  if v_vente.statut <> 'brouillon' then
    raise exception 'Seul un panier brouillon peut être abandonné';
  end if;
  if v_vente.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Seul le créateur du panier ou NAXA peut l’abandonner';
  end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select cs.statut into v_session_statut
  from public.caisses_sessions cs
  where cs.id=v_vente.caisse_session_id
  for update;
  if v_session_statut is distinct from 'ouverte' then
    raise exception 'La session de caisse n’est pas ouverte';
  end if;

  if not public.is_admin() then
    select * into v_profile
    from public.profiles
    where id=auth.uid() and actif=true;
    if not found or v_profile.pharmacie_id is distinct from v_vente.pharmacie_id
       or (coalesce(v_profile.role::text,'') <> 'caisse' and coalesce(v_profile.fonction_interne,'') <> 'caisse') then
      raise exception 'Abandon réservé à un compte Caisse actif de cette pharmacie';
    end if;
  end if;

  -- Les quantités sont débitées lors de l'ajout au panier : les restituer une
  -- seule fois avant de marquer le brouillon annulé. Le verrou sur la vente
  -- empêche deux abandons concurrents de restituer deux fois le même stock.
  for v_ligne in
    select vl.produit_id, vl.lot_id, vl.quantite
    from public.vente_lignes vl
    where vl.vente_id=p_vente
    order by vl.id
    for update
  loop
    if v_ligne.lot_id is not null then
      update public.stocks_lots
      set quantite=quantite+v_ligne.quantite
      where id=v_ligne.lot_id
        and pharmacie_id=v_vente.pharmacie_id
        and produit_id=v_ligne.produit_id;
      if not found then
        raise exception 'Lot d’origine introuvable ; abandon annulé sans clôture';
      end if;
    end if;

    update public.stocks
    set quantite=quantite+v_ligne.quantite,
        updated_at=now()
    where pharmacie_id=v_vente.pharmacie_id
      and produit_id=v_ligne.produit_id;
    if not found then
      raise exception 'Stock agrégé d’origine introuvable ; abandon annulé sans clôture';
    end if;
  end loop;

  update public.ventes
  set statut='annulee'
  where id=p_vente and statut='brouillon';
  if not found then
    raise exception 'Le panier a changé de statut pendant l’abandon';
  end if;
end;
$abandon$;

revoke all on function public.vente_brouillon_abandonner(uuid) from public,anon,authenticated;
grant execute on function public.vente_brouillon_abandonner(uuid) to authenticated;

-- Une référence saisie manuellement n'est pas une confirmation opérateur.
-- Tant que l'intégration marchande vérifiée n'existe pas, ces modes sont refusés
-- côté base pour empêcher de finaliser un faux paiement électronique.
create or replace function public.vente_encaisser(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant_percu integer,
  p_reference text default null
)
returns table(paiement_id uuid,montant_a_payer integer,monnaie_rendue integer)
language plpgsql
security definer
set search_path=''
as $encaisse$
declare
  v public.ventes%rowtype;
  v_id uuid;
  v_change integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant_percu is null or p_montant_percu<=0 then raise exception 'Montant perçu invalide'; end if;

  if p_mode in ('orange_money','mtn_momo','mobile_money') then
    raise exception 'Paiement électronique indisponible : aucune confirmation opérateur officielle n’est intégrée';
  end if;

  select * into v from public.ventes where id=p_vente for update;
  if not found or v.statut<>'brouillon' then raise exception 'Vente invalide ou déjà finalisée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  if not exists(select 1 from public.vente_lignes where vente_id=p_vente) then raise exception 'Vente vide'; end if;

  if p_mode='especes' and p_montant_percu<v.total_net then
    raise exception 'Montant espèces insuffisant';
  end if;
  if p_mode<>'especes' and p_montant_percu<>v.total_net then
    raise exception 'Pour ce mode, le montant perçu doit correspondre exactement au total';
  end if;

  v_change:=case when p_mode='especes' then greatest(p_montant_percu-v.total_net,0) else 0 end;
  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue)
  values(p_vente,p_mode,v.total_net,nullif(trim(p_reference),''),auth.uid(),p_montant_percu,v_change)
  returning id into v_id;
  return query select v_id,v.total_net,v_change;
end;
$encaisse$;

revoke all on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
grant execute on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) to authenticated;

-- Ferme également la voie historique d'encaissement par paiement fractionné.
create or replace function public.vente_ajouter_paiement(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant integer,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $paiement$
declare
  v_vente public.ventes%rowtype;
  v_id uuid;
  v_deja integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant<=0 then raise exception 'Montant de paiement invalide'; end if;
  if p_mode in ('orange_money','mtn_momo','mobile_money') then
    raise exception 'Paiement électronique indisponible : aucune confirmation opérateur officielle n’est intégrée';
  end if;

  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then raise exception 'Vente introuvable ou déjà clôturée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  select coalesce(sum(montant),0) into v_deja from public.vente_paiements where vente_id=p_vente;
  if v_deja+p_montant>v_vente.total_net then raise exception 'Le paiement dépasse le total de la vente'; end if;
  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by)
  values(p_vente,p_mode,p_montant,nullif(trim(p_reference),''),auth.uid())
  returning id into v_id;
  return v_id;
end;
$paiement$;

revoke all on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
grant execute on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) to authenticated;

commit;
