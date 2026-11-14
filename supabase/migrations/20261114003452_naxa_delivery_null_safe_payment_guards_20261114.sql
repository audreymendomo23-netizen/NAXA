-- NAXA — garde-fous paiement/preparation et index manquants, relevés sur Naxa le 14/11/2026.
-- Cette source versionne les définitions déjà appliquées au projet Naxa.
-- Elle conserve les ACL et SECURITY DEFINER/search_path des fonctions existantes.
BEGIN;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reservations
    WHERE preparation_statut IS NULL
  ) THEN
    RAISE EXCEPTION 'Réconciliation arrêtée : reservations.preparation_statut contient encore des NULL';
  END IF;
END
$guard$;

ALTER TABLE public.reservations
  ALTER COLUMN preparation_statut SET NOT NULL;

CREATE INDEX IF NOT EXISTS naxa_delivery_commission_pharmacie_month_idx ON public.naxa_delivery_commission_ledger USING btree (pharmacie_id, settlement_month);

CREATE INDEX IF NOT EXISTS naxa_delivery_commission_promoteur_month_idx ON public.naxa_delivery_commission_ledger USING btree (promoteur_id, settlement_month);

CREATE INDEX IF NOT EXISTS naxa_delivery_commission_zone_idx ON public.naxa_delivery_commission_ledger USING btree (zone_id);

CREATE INDEX IF NOT EXISTS naxa_delivery_events_actor_id_idx ON public.naxa_delivery_events USING btree (actor_id);

CREATE INDEX IF NOT EXISTS naxa_delivery_events_pharmacie_time_idx ON public.naxa_delivery_events USING btree (pharmacie_id, created_at DESC);

CREATE INDEX IF NOT EXISTS naxa_delivery_missions_ready_by_idx ON public.naxa_delivery_missions USING btree (ready_by);

CREATE INDEX IF NOT EXISTS naxa_delivery_offers_pharmacie_status_time_idx ON public.naxa_delivery_mission_offers USING btree (pharmacie_id, offer_status, offered_at DESC);

CREATE INDEX IF NOT EXISTS naxa_delivery_offers_reservation_idx ON public.naxa_delivery_mission_offers USING btree (reservation_id);

CREATE INDEX IF NOT EXISTS naxa_delivery_payment_caisse_session_idx ON public.naxa_delivery_payment_records USING btree (caisse_session_id);

CREATE INDEX IF NOT EXISTS naxa_delivery_payment_client_time_idx ON public.naxa_delivery_payment_records USING btree (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS naxa_delivery_payment_declared_by_idx ON public.naxa_delivery_payment_records USING btree (declared_by);

CREATE INDEX IF NOT EXISTS naxa_delivery_payment_livreur_time_idx ON public.naxa_delivery_payment_records USING btree (livreur_id, created_at DESC);

CREATE INDEX IF NOT EXISTS naxa_delivery_payment_validated_by_idx ON public.naxa_delivery_payment_records USING btree (validated_by);

CREATE INDEX IF NOT EXISTS naxa_delivery_reviews_client_time_idx ON public.naxa_delivery_reviews USING btree (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS naxa_livreur_invites_accepted_by_idx ON public.naxa_livreur_invites USING btree (accepted_by);

CREATE INDEX IF NOT EXISTS naxa_livreur_invites_assignment_idx ON public.naxa_livreur_invites USING btree (assignment_id);

CREATE INDEX IF NOT EXISTS naxa_livreur_invites_inviteur_time_idx ON public.naxa_livreur_invites USING btree (inviteur_id, created_at DESC);

CREATE INDEX IF NOT EXISTS naxa_livreur_invites_pharmacie_time_idx ON public.naxa_livreur_invites USING btree (pharmacie_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.naxa_delivery_driver_can_act(p_user uuid, p_mission uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_user is not null and exists (
    select 1
    from public.naxa_delivery_missions m
    join public.reservations r on r.id=m.reservation_id
    join public.profiles p on p.id=m.livreur_id and p.actif=true
    join public.pharmacies ph on ph.id=m.pharmacie_id
      and ph.actif=true and ph.archivee_le is null
    join public.naxa_professional_assignments a
      on a.profile_id=m.livreur_id
     and a.pharmacie_id=m.pharmacie_id
     and a.role_code='livreur'
     and a.statut='active'
     and a.commence_at<=now()
     and (
       a.expire_at is null
       or a.expire_at>now()
       or m.statut in ('accepted','picked_up','arrived')
     )
    where m.id=p_mission
      and m.livreur_id=p_user
      and public.naxa_business_function(p_user)='livreur'
      and public.naxa_active_role_pharmacy(p_user)=m.pharmacie_id
      and r.preparation_statut='prete_au_retrait'
      and r.paiement_mode is not null
      and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue')
  )
$function$
;

CREATE OR REPLACE FUNCTION private.naxa_delivery_finalize_if_confirmed(p_mission uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_region text;
  v_ville text;
  v_promoteur uuid;
  v_zone_id uuid;
  v_zone_type text:='standard';
  v_zone_name text;
  v_zone_supplement integer:=0;
  v_formula text:='progressive_zones_v1';
  v_distance numeric(7,2);
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.statut='delivered' then return found; end if;
  if v_m.statut<>'arrived' or v_m.client_confirme_at is null or v_m.livreur_confirme_at is null then
    return false;
  end if;

  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  if v_r.paiement_mode is null or v_r.paiement_statut is distinct from 'effectue' then return false; end if;

  select ph.region,ph.ville into v_region,v_ville
  from public.pharmacies ph where ph.id=v_m.pharmacie_id;
  select pp.promoteur_id into v_promoteur
  from public.promoteur_pharmacies pp
  where pp.pharmacie_id=v_m.pharmacie_id and pp.actif
  order by pp.created_at asc limit 1;

  select q.zone_id,coalesce(q.zone_type,'standard'),q.zone_nom_snapshot,
         coalesce(q.zone_supplement_fcfa,0),coalesce(q.formule_version,'progressive_zones_v1'),
         q.distance_routiere_km
  into v_zone_id,v_zone_type,v_zone_name,v_zone_supplement,v_formula,v_distance
  from public.naxa_delivery_quotes q
  where q.id=v_r.delivery_quote_id;

  v_zone_type:=coalesce(v_zone_type,'standard');
  v_zone_supplement:=coalesce(v_zone_supplement,0);
  v_formula:=coalesce(v_formula,'progressive_zones_v1');
  v_distance:=coalesce(v_distance,v_r.distance_livraison_km);

  update public.naxa_delivery_missions
  set statut='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now()
  where id=p_mission;
  update public.naxa_delivery_mission_offers
  set offer_status='delivered',delivered_at=coalesce(delivered_at,now())
  where mission_id=p_mission and livreur_id=v_m.livreur_id and offer_status='accepted';
  update public.reservations set commande_statut='livree' where id=v_m.reservation_id;

  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_m.livreur_id,'delivered','Réception Client et Livreur confirmée après paiement validé')
  on conflict do nothing;

  if v_r.frais_livraison between 1500 and 3500 then
    insert into public.naxa_delivery_commission_ledger(
      mission_id,reservation_id,pharmacie_id,promoteur_id,region,ville,delivered_at,
      settlement_month,frais_livraison_client,commission_naxa,solde_livraison,
      distance_livraison_km,zone_id,zone_type,zone_nom_snapshot,zone_supplement_fcfa,formule_version
    ) values(
      v_m.id,v_r.id,v_m.pharmacie_id,v_promoteur,v_region,v_ville,
      coalesce(v_m.delivered_at,now()),
      date_trunc('month',coalesce(v_m.delivered_at,now()))::date,
      v_r.frais_livraison,500,v_r.frais_livraison-500,
      v_distance,v_zone_id,v_zone_type,v_zone_name,v_zone_supplement,v_formula
    ) on conflict(mission_id) do nothing;
  end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gestionnaire_stock_commande_preparation(p_reservation uuid, p_etat text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then raise exception 'Commande hors périmètre pharmacie'; end if;
  if v_r.commande_statut not in ('acceptee','preparation','livreur_assigne')
    or v_r.livraison_confirmee_stock_at is null
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'La pharmacie doit avoir accepté la demande de livraison';
  end if;
  if v_r.paiement_mode is null or (v_r.paiement_mode is distinct from 'especes_livraison' and v_r.paiement_statut is distinct from 'effectue') then
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
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_accept(p_mission uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif=true and ph.archivee_le is null) then
    raise exception 'La pharmacie est suspendue ou archivée';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.statut<>'available' or v_m.pharmacie_id<>v_pharmacy then
    raise exception 'Mission déjà prise ou indisponible';
  end if;
  select * into v_r from public.reservations where id=v_m.reservation_id for share;
  if not found or v_r.preparation_statut is distinct from 'prete_au_retrait'
    or v_r.paiement_mode is null
    or (v_r.paiement_mode is distinct from 'especes_livraison' and v_r.paiement_statut is distinct from 'effectue') then
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
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_courier_declare_cash(p_mission uuid, p_cash_received integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_due integer;
begin
  if v_uid is null then raise exception 'Connexion Livreur requise'; end if;
  if p_cash_received is null or p_cash_received<=0 then raise exception 'Montant espèces invalide'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.livreur_id is distinct from v_uid
    or v_m.statut<>'arrived' or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Seul le Livreur affecté peut déclarer les espèces à la remise';
  end if;
  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  if v_r.mode<>'commande' or v_r.paiement_mode is distinct from 'especes_livraison'
    or v_r.livraison_confirmee_stock_at is null or v_r.paiement_statut='effectue' then
    raise exception 'Cette commande ne permet pas un encaissement espèces à la livraison';
  end if;
  v_due:=v_r.total+v_r.frais_livraison;
  if p_cash_received<v_due then raise exception 'Montant espèces insuffisant'; end if;

  insert into public.naxa_delivery_payment_records(
    reservation_id,mission_id,pharmacie_id,client_id,livreur_id,mode,expected_amount,
    cash_received,cash_change,status,declared_by,declared_at
  ) values(
    v_r.id,v_m.id,v_r.pharmacie_id,v_r.client_id,v_uid,'especes_livraison',
    v_due,p_cash_received,p_cash_received-v_due,'cash_declared',v_uid,now()
  )
  on conflict(reservation_id) do update
  set mission_id=v_m.id,livreur_id=v_uid,mode='especes_livraison',
      expected_amount=v_due,cash_received=p_cash_received,
      cash_change=p_cash_received-v_due,status='cash_declared',
      declared_by=v_uid,declared_at=now(),validated_by=null,validated_at=null,
      caisse_session_id=null,vente_id=null,rejection_reason=null,updated_at=now()
  where public.naxa_delivery_payment_records.status<>'paid';

  if not found then raise exception 'Un paiement est déjà validé pour cette commande'; end if;
  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_r.pharmacie_id,'delivery_cash_declared','Espèces reçues par le Livreur · validation requise',
    'Le Livreur déclare avoir reçu les espèces du Client. La Caisse doit rapprocher le montant avant clôture de la livraison.',
    v_r.id,v_m.id);
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_make_available(p_reservation uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_r public.reservations%rowtype;
  v_pharmacy uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT r.pharmacie_id INTO v_pharmacy
  FROM public.reservations r
  WHERE r.id = p_reservation;

  IF NOT FOUND OR NOT public.naxa_scope_allows(v_uid, v_pharmacy, 'PHARMACIE') THEN
    RAISE EXCEPTION 'Commande de livraison introuvable ou hors périmètre pharmacie';
  END IF;

  SELECT * INTO v_r
  FROM public.reservations
  WHERE id = p_reservation
  FOR UPDATE;

  IF NOT FOUND OR v_r.mode IS DISTINCT FROM 'commande' THEN
    RAISE EXCEPTION 'Commande de livraison introuvable';
  END IF;

  IF v_r.livraison_confirmee_stock_at IS NULL
     OR v_r.preparation_statut IS DISTINCT FROM 'prete_au_retrait'
     OR v_r.statut IN ('annulee', 'expiree', 'retiree') THEN
    RAISE EXCEPTION 'La mission ne peut être publiée qu’après préparation physique confirmée par Stock';
  END IF;

  IF v_r.paiement_mode IS NULL
     OR (v_r.paiement_mode IS DISTINCT FROM 'especes_livraison'
         AND v_r.paiement_statut IS DISTINCT FROM 'effectue') THEN
    RAISE EXCEPTION 'Le paiement doit être sélectionné et vérifié avant publication de la mission';
  END IF;

  RETURN public.naxa_delivery_make_available_before_preparation_gate(p_reservation);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_make_available_before_preparation_gate(p_reservation uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
  v_m public.naxa_delivery_missions%rowtype;
  v_mission uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande de livraison introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Commande hors périmètre pharmacie';
  end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=v_r.pharmacie_id and ph.actif=true and ph.archivee_le is null) then
    raise exception 'La pharmacie est suspendue ou archivée';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Seul le Gestionnaire de stock ou Magasinier peut publier une mission';
  end if;
  if v_r.commande_statut not in ('acceptee','preparation','livreur_assigne')
    or v_r.preparation_statut is distinct from 'prete_au_retrait'
    or v_r.livraison_confirmee_stock_at is null
    or v_r.paiement_mode is null
    or (v_r.paiement_mode is distinct from 'especes_livraison' and v_r.paiement_statut is distinct from 'effectue')
    or v_r.statut in ('annulee','expiree','retiree')
    or v_r.livraison_demande_at is null then
    raise exception 'La demande doit être confirmée par Stock avant de prévenir les livreurs';
  end if;

  select * into v_m from public.naxa_delivery_missions where reservation_id=p_reservation for update;
  if found then
    if v_m.statut='cancelled' then raise exception 'Cette commande a été annulée et ne peut plus être republiée'; end if;
    if v_m.statut='failed' then raise exception 'Cette mission doit être réaffectée par la pharmacie'; end if;
    return v_m.id;
  end if;

  insert into public.naxa_delivery_missions(reservation_id,pharmacie_id,client_id,ready_by)
  values(v_r.id,v_r.pharmacie_id,v_r.client_id,v_uid)
  returning id into v_mission;

  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label
  ) values(
    v_mission,v_r.id,v_r.pharmacie_id,v_uid,'ready',
    'Demande de livraison confirmée par Stock · mission proposée aux livreurs'
  );

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_mission,v_r.id,v_r.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,'delivery_mission','Livraison à accepter',
    'Une demande de livraison a été confirmée par Stock. Acceptez la mission ; le retrait sera autorisé après paiement et préparation.',
    v_r.id,v_mission
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  return v_mission;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_my_missions(p_include_history boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_pharmacy uuid;
  v_result jsonb;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Espace Livreur requis';
  end if;
  select public.naxa_active_role_pharmacy(v_uid) into v_pharmacy;
  if v_pharmacy is null
    or not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif=true and ph.archivee_le is null)
    or (
      not exists(
        select 1 from public.naxa_professional_assignments a
        where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy and a.role_code='livreur'
          and a.statut='active' and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      )
      and not exists(
        select 1 from public.naxa_delivery_missions m
        where m.livreur_id=v_uid and m.pharmacie_id=v_pharmacy
          and m.statut in ('accepted','picked_up','arrived')
      )
    ) then
    raise exception 'Affectation Livreur inactive';
  end if;

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
    and r.paiement_mode is not null
    and (r.paiement_mode='especes_livraison' or r.paiement_statut='effectue');
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_pickup(p_mission uuid, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_accuracy_m double precision DEFAULT NULL::double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_duration integer;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut<>'accepted' then
    raise exception 'Seul le livreur actif affecté peut retirer cette commande';
  end if;
  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  if v_r.commande_statut is distinct from 'livreur_assigne' or v_r.preparation_statut is distinct from 'prete_au_retrait' then
    raise exception 'La commande doit être payée et déclarée prête par le Gestionnaire de stock';
  end if;
  if v_r.paiement_mode is null or (v_r.paiement_mode is distinct from 'especes_livraison' and v_r.paiement_statut is distinct from 'effectue') then
    raise exception 'Paiement électronique non vérifié';
  end if;
  if (p_latitude is null)<>(p_longitude is null)
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180))
    or (p_accuracy_m is not null and p_accuracy_m not between 0 and 10000) then
    raise exception 'Position GPS invalide';
  end if;

  v_duration:=greatest(10,coalesce(v_r.duree_livraison_estimee_min,round(coalesce(v_r.distance_livraison_km,2)*5)::integer));
  update public.naxa_delivery_missions set statut='picked_up',picked_up_at=now(),updated_at=now() where id=p_mission;
  update public.reservations set
    commande_statut='en_livraison',
    livraison_depart_at=now(),
    livraison_echeance_at=now()+make_interval(mins=>v_duration),
    duree_livraison_estimee_min=v_duration
  where id=v_r.id;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude,accuracy_m
  ) values(
    p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'picked_up','Commande récupérée · début du délai de livraison',
    p_latitude,p_longitude,p_accuracy_m
  );
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_pos_encaisser(p_reservation uuid, p_session uuid, p_montant_percu integer, p_canal text, p_code_paiement text, p_reference text DEFAULT NULL::text)
 RETURNS TABLE(vente_id uuid, numero_vente text, total integer, monnaie_rendue integer, canal text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_record public.naxa_delivery_payment_records%rowtype;
  v_sale uuid;
  v_number text;
  v_due integer;
  v_change integer:=0;
  v_mode public.mode_paiement_caisse;
  v_expected_channel text;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null or p_code_paiement is null then
    raise exception 'Commande, session et code de paiement requis';
  end if;
  if p_montant_percu is null or p_montant_percu<=0 then raise exception 'Montant encaissé invalide'; end if;
  if p_canal not in ('especes','orange_money','mtn_momo','mobile_money') then
    raise exception 'Canal de paiement non pris en charge';
  end if;
  v_mode:=p_canal::public.mode_paiement_caisse;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' or v_r.livraison_confirmee_stock_at is null
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne','en_livraison')
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Commande non éligible à un encaissement Livraison';
  end if;
  if upper(btrim(v_r.code_paiement))<>upper(btrim(p_code_paiement)) then
    raise exception 'Code de commande incorrect';
  end if;
  if not public.naxa_caisse_actor_for_pharmacy(v_r.pharmacie_id) then
    raise exception 'Encaissement réservé à la Caisse active de cette pharmacie';
  end if;
  select cs.* into v_session
  from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte' and cs.ouvert_par=v_uid
    and c.actif=true and c.pharmacie_id=v_r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session Caisse ouverte introuvable ou hors pharmacie'; end if;
  select * into v_record from public.naxa_delivery_payment_records
  where reservation_id=v_r.id for update;
  if not found then raise exception 'Déclaration de paiement ou de remise espèces absente'; end if;
  if v_record.status='paid' then raise exception 'Paiement déjà validé'; end if;

  v_due:=v_r.total+v_r.frais_livraison;
  if p_canal='especes' then
    if v_r.paiement_mode is distinct from 'especes_livraison' or v_record.status<>'cash_declared'
      or v_record.cash_received is null or p_montant_percu<>v_record.cash_received
      or p_montant_percu<v_due then
      raise exception 'Les espèces doivent avoir été déclarées par le Livreur et rapprochées exactement';
    end if;
    v_change:=p_montant_percu-v_due;
    v_expected_channel:='especes';
  else
    v_expected_channel:=case when p_canal='mtn_momo' then 'mtn_marchand'
      when p_canal='orange_money' then 'orange_money' else 'mobile_money' end;
    if v_r.paiement_mode is distinct from v_expected_channel or v_record.status<>'declared'
      or v_record.reference is null
      or upper(btrim(v_record.reference))<>upper(btrim(coalesce(p_reference,'')))
      or upper(btrim(coalesce(v_r.paiement_ref,'')))<>upper(btrim(coalesce(p_reference,'')))
      or p_montant_percu<>v_due then
      raise exception 'Référence, canal ou montant ne correspond pas à la déclaration du Client';
    end if;
  end if;
  if exists(select 1 from public.ventes v where v.reservation_id=v_r.id) then
    raise exception 'Une vente est déjà liée à cette commande';
  end if;

  insert into public.ventes(
    pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,
    frais_livraison,created_by,reservation_id,stock_decremented_at_draft
  ) values(
    v_r.pharmacie_id,p_session,v_r.client_id,'brouillon',0,v_r.total,v_due,
    v_r.frais_livraison,v_uid,v_r.id,true
  ) returning id,numero_vente into v_sale,v_number;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  select v_sale,ri.produit_id,ri.quantite,ri.prix_unitaire
  from public.reservation_items ri
  where ri.reservation_id=v_r.id
  order by ri.produit_id;

  insert into public.vente_paiements(
    vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
  ) values(
    v_sale,v_mode,v_due,
    coalesce(nullif(trim(p_reference),''),'Livraison espèces déclarée par le Livreur'),
    v_uid,p_montant_percu,v_change
  );

  update public.ventes set
    statut='payee',mode_paiement=v_mode,
    paiement_ref=coalesce(nullif(trim(p_reference),''),'Livraison espèces'),
    paid_at=now()
  where id=v_sale and statut='brouillon';
  if not found then raise exception 'La vente de livraison n’a pas pu être finalisée'; end if;

  update public.naxa_delivery_payment_records
  set status='paid',validated_by=v_uid,validated_at=now(),
      caisse_session_id=p_session,vente_id=v_sale,
      cash_change=v_change,updated_at=now()
  where id=v_record.id;

  update public.reservations set
    paiement_statut='effectue',
    paiement_montant_percu=p_montant_percu,
    paiement_monnaie_rendue=v_change,
    paiement_valide_at=now(),
    paiement_ticket_numero=v_number
  where id=v_r.id;
  perform public.set_reservation_status(v_r.id,'payee'::public.resa_statut);
  perform private.naxa_delivery_finalize_if_confirmed((select id from public.naxa_delivery_missions where reservation_id=v_r.id));

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_r.client_id,'delivery_payment_confirmed','Paiement de livraison confirmé',
    'La pharmacie a validé votre paiement. Votre reçu est disponible dans le suivi de commande.',
    v_r.id,v_sale);
  return query select v_sale,v_number,v_due,v_change,p_canal;
end;
$function$
;

REVOKE ALL ON FUNCTION public.naxa_delivery_make_available_before_preparation_gate(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.naxa_delivery_make_available_before_preparation_gate(uuid)
  TO service_role;

COMMIT;
