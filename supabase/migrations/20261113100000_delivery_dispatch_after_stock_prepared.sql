-- NAXA — publication Livreur après paiement admis et préparation physique Stock.
begin;

-- Conserver la logique existante de publication derrière un wrapper qui impose le garde-fou.
alter function public.naxa_delivery_make_available(uuid)
  rename to naxa_delivery_make_available_before_preparation_gate;

revoke all on function public.naxa_delivery_make_available_before_preparation_gate(uuid)
  from public,anon,authenticated;

create or replace function public.naxa_delivery_make_available(p_reservation uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_r public.reservations%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande de livraison introuvable'; end if;
  if v_r.livraison_confirmee_stock_at is null
    or v_r.preparation_statut<>'prete_au_retrait'
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'La mission ne peut être publiée qu’après préparation physique confirmée par Stock';
  end if;
  if v_r.paiement_mode<>'especes_livraison' and v_r.paiement_statut<>'effectue' then
    raise exception 'Le paiement électronique doit être vérifié avant publication de la mission';
  end if;
  return public.naxa_delivery_make_available_before_preparation_gate(p_reservation);
end;
$function$;
revoke all on function public.naxa_delivery_make_available(uuid) from public,anon;
grant execute on function public.naxa_delivery_make_available(uuid) to authenticated;

-- L'acceptation de la demande prévient le Client, jamais les Livreurs.
create or replace function public.gestionnaire_stock_confirmer_demande_livraison(p_reservation uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' or v_r.commande_statut<>'en_attente_pharmacie'
    or v_r.statut in ('annulee','expiree','retiree')
    or v_r.livraison_demande_at is null then
    raise exception 'Cette demande de livraison ne peut plus être confirmée';
  end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Demande hors périmètre pharmacie';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Seul le Gestionnaire de stock ou Magasinier peut confirmer la demande';
  end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=v_r.pharmacie_id
    and ph.actif=true and ph.archivee_le is null and ph.livraison_active=true) then
    raise exception 'Service de livraison indisponible';
  end if;

  update public.reservations
  set commande_statut='acceptee',
      livraison_confirmee_stock_at=coalesce(livraison_confirmee_stock_at,now()),
      livraison_paiement_demande_at=coalesce(livraison_paiement_demande_at,now())
  where id=p_reservation;

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_r.client_id,'delivery_payment_request','Livraison acceptée · paiement demandé',
    'La pharmacie accepte votre demande. Choisissez votre mode de paiement. Les Livreurs seront notifiés après la vérification du paiement requis et la préparation physique.',
    v_r.id,null);
  return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_confirmer_demande_livraison(uuid) from public,anon;
grant execute on function public.gestionnaire_stock_confirmer_demande_livraison(uuid) to authenticated;

-- La préparation physique reste impossible tant que le paiement électronique n'est pas rapproché.
-- C'est uniquement le passage à "prete_au_retrait" qui publie la mission.
create or replace function public.gestionnaire_stock_commande_preparation(
  p_reservation uuid,
  p_etat text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_etat not in ('en_preparation','prete_au_retrait') then
    raise exception 'État de préparation invalide';
  end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande Marketplace introuvable'; end if;
  if v_r.commande_statut not in ('acceptee','preparation','livreur_assigne')
    or v_r.livraison_confirmee_stock_at is null
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'La pharmacie doit avoir accepté la demande de livraison';
  end if;
  if v_r.paiement_mode<>'especes_livraison' and v_r.paiement_statut<>'effectue' then
    raise exception 'Le paiement électronique doit être vérifié avant la préparation destinée à la livraison';
  end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Commande hors périmètre pharmacie';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Action réservée au Gestionnaire de stock ou Magasinier';
  end if;
  if v_r.preparation_statut='annulee' then raise exception 'Préparation annulée'; end if;

  if p_etat='en_preparation' then
    if v_r.preparation_statut='prete_au_retrait' then
      raise exception 'La commande est déjà déclarée prête';
    end if;
    update public.reservations
    set preparation_statut='en_preparation',
        preparation_demarre_le=coalesce(preparation_demarre_le,now())
    where id=p_reservation;
    return true;
  end if;

  if v_r.preparation_statut='prete_au_retrait' then
    perform public.naxa_delivery_make_available(p_reservation);
    return true;
  end if;
  if v_r.preparation_statut is distinct from 'en_preparation' then
    raise exception 'Démarrez la préparation avant de confirmer que la commande est prête';
  end if;

  update public.reservations
  set preparation_statut='prete_au_retrait',
      prete_au_retrait_le=now()
  where id=p_reservation;

  perform public.naxa_delivery_make_available(p_reservation);
  return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_commande_preparation(uuid,text) from public,anon;
grant execute on function public.gestionnaire_stock_commande_preparation(uuid,text) to authenticated;

-- Un ancien enregistrement prématuré ne doit pas pouvoir être accepté par un Livreur.
create or replace function public.naxa_delivery_accept(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_pharmacy uuid;
  v_offer uuid;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Poste Livreur actif requis';
  end if;
  v_pharmacy:=public.naxa_active_role_pharmacy(v_uid);
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.statut<>'available' or v_m.pharmacie_id<>v_pharmacy then
    raise exception 'Mission déjà prise ou indisponible';
  end if;
  select * into v_r from public.reservations where id=v_m.reservation_id for share;
  if not found or v_r.preparation_statut<>'prete_au_retrait'
    or (v_r.paiement_mode<>'especes_livraison' and v_r.paiement_statut<>'effectue') then
    raise exception 'Stock et paiement doivent être confirmés avant l’acceptation du Livreur';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.actif=true)
    or not exists(select 1 from public.naxa_professional_assignments a
      where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy and a.role_code='livreur'
        and a.statut='active' and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())) then
    raise exception 'Affectation Livreur suspendue ou expirée';
  end if;

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid
  where not exists(select 1 from public.naxa_delivery_mission_offers o
    where o.mission_id=v_m.id and o.livreur_id=v_uid and o.offer_status='offered')
  returning id into v_offer;

  update public.naxa_delivery_missions
  set livreur_id=v_uid,statut='accepted',accepted_at=now(),updated_at=now()
  where id=p_mission and statut='available';
  if not found then raise exception 'Cette mission vient d’être prise par un autre livreur'; end if;

  update public.naxa_delivery_mission_offers
  set offer_status=case when livreur_id=v_uid then 'accepted' else 'lost' end,
      accepted_at=case when livreur_id=v_uid then now() else accepted_at end
  where mission_id=v_m.id and offer_status='offered';

  update public.reservations set commande_statut='livreur_assigne' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'accepted','Livraison acceptée par un livreur');
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_accept(uuid) from public,anon;
grant execute on function public.naxa_delivery_accept(uuid) to authenticated;

-- Le RPC de l'espace Livreur ne présente que les missions effectivement prêtes.
create or replace function public.naxa_delivery_my_missions(p_include_history boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_pharmacy uuid;
  v_result jsonb;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Espace Livreur requis';
  end if;
  select public.naxa_active_role_pharmacy(v_uid) into v_pharmacy;
  if v_pharmacy is null or not exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy and a.role_code='livreur'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
  ) then raise exception 'Affectation Livreur inactive'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'reservation_id',m.reservation_id,'statut',m.statut,
    'created_at',m.created_at,'ready_at',m.ready_at,'accepted_at',m.accepted_at,
    'picked_up_at',m.picked_up_at,'arrived_at',m.arrived_at,'delivered_at',m.delivered_at,
    'failure_code',m.failure_code,'failure_note',m.failure_note,
    'commande_statut',r.commande_statut,'total',r.total,'frais_livraison',r.frais_livraison,
    'created_order_at',r.created_at,'ville',r.ville_livraison,'quartier',r.quartier_livraison,
    'adresse',case when m.livreur_id=v_uid then r.adresse_livraison else null end,
    'repere',case when m.livreur_id=v_uid then r.repere_livraison else null end,
    'telephone',case when m.livreur_id=v_uid then r.telephone_livraison else null end,
    'items',case when m.livreur_id=v_uid then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'quantite',ri.quantite,'nom',p.nom,'dosage',p.dosage
      ) order by ri.produit_id),'[]'::jsonb)
      from public.reservation_items ri join public.produits p on p.id=ri.produit_id
      where ri.reservation_id=r.id
    ) else '[]'::jsonb end
  ) order by case when m.statut='available' then 0 else 1 end,m.ready_at),'[]'::jsonb)
  into v_result
  from public.naxa_delivery_missions m
  join public.reservations r on r.id=m.reservation_id
  where m.pharmacie_id=v_pharmacy
    and (m.statut='available' or m.livreur_id=v_uid)
    and (p_include_history or m.statut in ('available','accepted','picked_up','arrived'))
    and r.preparation_statut='prete_au_retrait'
    and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue');
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_missions(boolean) from public,anon;
grant execute on function public.naxa_delivery_my_missions(boolean) to authenticated;

create or replace function private.naxa_delivery_driver_can_act(p_user uuid,p_mission uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_user is not null and exists (
    select 1
    from public.naxa_delivery_missions m
    join public.reservations r on r.id=m.reservation_id
    join public.profiles p on p.id=m.livreur_id and p.actif=true
    join public.naxa_professional_assignments a
      on a.profile_id=m.livreur_id
     and a.pharmacie_id=m.pharmacie_id
     and a.role_code='livreur'
     and a.statut='active'
     and a.commence_at<=now()
     and (a.expire_at is null or a.expire_at>now())
    where m.id=p_mission
      and m.livreur_id=p_user
      and public.naxa_business_function(p_user)='livreur'
      and public.naxa_active_role_pharmacy(p_user)=m.pharmacie_id
      and r.preparation_statut='prete_au_retrait'
      and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue')
  )
$function$;
revoke all on function private.naxa_delivery_driver_can_act(uuid,uuid) from public,anon,authenticated;

-- Masquer aussi les missions prématurées encore présentes dans les lignes anciennes.
drop policy if exists naxa_delivery_mission_participant_read on public.naxa_delivery_missions;
create policy naxa_delivery_mission_participant_read
on public.naxa_delivery_missions for select to authenticated
using (
  client_id=(select auth.uid())
  or (
    livreur_id=(select auth.uid())
    and exists (
      select 1 from public.reservations r
      where r.id=naxa_delivery_missions.reservation_id
        and r.preparation_statut='prete_au_retrait'
        and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue')
    )
  )
  or (
    statut='available'
    and exists (
      select 1 from public.reservations r
      where r.id=naxa_delivery_missions.reservation_id
        and r.preparation_statut='prete_au_retrait'
        and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue')
    )
    and exists (
      select 1 from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif=true
      where a.profile_id=(select auth.uid())
        and a.role_code='livreur' and a.pharmacie_id=naxa_delivery_missions.pharmacie_id
        and a.statut='active' and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
    )
  )
  or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE')
);

drop policy if exists naxa_delivery_event_participant_read on public.naxa_delivery_events;
create policy naxa_delivery_event_participant_read
on public.naxa_delivery_events for select to authenticated
using (
  exists (
    select 1 from public.naxa_delivery_missions m
    join public.reservations r on r.id=m.reservation_id
    where m.id=naxa_delivery_events.mission_id
      and (
        m.client_id=(select auth.uid())
        or (
          m.livreur_id=(select auth.uid())
          and r.preparation_statut='prete_au_retrait'
          and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue')
        )
        or public.naxa_scope_allows((select auth.uid()),m.pharmacie_id,'PHARMACIE')
      )
  )
);

commit;
