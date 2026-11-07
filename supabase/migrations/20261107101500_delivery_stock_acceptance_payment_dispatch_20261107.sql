begin;

alter table public.reservations
  add column if not exists duree_livraison_estimee_min integer,
  add column if not exists livraison_echeance_at timestamptz;

create or replace function public.naxa_delivery_make_available(p_reservation uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
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
    or v_r.livraison_confirmee_stock_at is null
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
$function$;
revoke all on function public.naxa_delivery_make_available(uuid) from public,anon;
grant execute on function public.naxa_delivery_make_available(uuid) to authenticated;

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
  v_mission uuid;
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
    'La pharmacie accepte votre demande. Choisissez votre mode de paiement dans le suivi de commande pour poursuivre.',
    v_r.id,null);

  v_mission:=public.naxa_delivery_make_available(p_reservation);
  return v_mission is not null;
end;
$function$;
revoke all on function public.gestionnaire_stock_confirmer_demande_livraison(uuid) from public,anon;
grant execute on function public.gestionnaire_stock_confirmer_demande_livraison(uuid) to authenticated;

create or replace function public.naxa_client_set_delivery_payment_mode(
  p_reservation uuid,
  p_mode text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_r public.reservations%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_mode not in ('mtn_marchand','orange_money','especes_livraison') then
    raise exception 'Choisissez un mode de paiement autorisé pour une livraison';
  end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.client_id<>v_uid or v_r.mode<>'commande'
    or v_r.livraison_confirmee_stock_at is null
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne') then
    raise exception 'La pharmacie doit confirmer la livraison avant le choix du paiement';
  end if;
  if v_r.statut in ('annulee','expiree','retiree','payee') then
    raise exception 'Cette commande ne peut plus recevoir de changement de paiement';
  end if;

  update public.reservations set paiement_mode=p_mode where id=p_reservation;
  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id)
  values(v_r.pharmacie_id,'delivery_payment_mode','Mode de paiement de livraison choisi',
    case when p_mode='especes_livraison'
      then 'Le Client a choisi le paiement en espèces à la livraison.'
      else 'Le Client a choisi un paiement électronique. Le paiement doit être encaissé et vérifié via la caisse autorisée.'
    end,
    v_r.id);
  return true;
end;
$function$;
revoke all on function public.naxa_client_set_delivery_payment_mode(uuid,text) from public,anon;
grant execute on function public.naxa_client_set_delivery_payment_mode(uuid,text) to authenticated;

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
  else
    if v_r.preparation_statut='prete_au_retrait' then return true; end if;
    if v_r.preparation_statut is distinct from 'en_preparation' then
      raise exception 'Démarrez la préparation avant de confirmer que la commande est prête';
    end if;
    update public.reservations
    set preparation_statut='prete_au_retrait',
        prete_au_retrait_le=now()
    where id=p_reservation;
  end if;
  return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_commande_preparation(uuid,text) from public,anon;
grant execute on function public.gestionnaire_stock_commande_preparation(uuid,text) to authenticated;

create or replace function public.naxa_delivery_pickup(
  p_mission uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
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
  if v_r.commande_statut<>'livreur_assigne' or v_r.preparation_statut<>'prete_au_retrait' then
    raise exception 'La commande doit être payée et déclarée prête par le Gestionnaire de stock';
  end if;
  if v_r.paiement_mode<>'especes_livraison' and v_r.paiement_statut<>'effectue' then
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
$function$;
revoke all on function public.naxa_delivery_pickup(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_pickup(uuid,double precision,double precision,double precision) to authenticated;

-- The general pharmacy transition API may no longer accept a delivery request before Stock.
create or replace function public.mettre_a_jour_commande_client(
  p_id uuid,p_statut text,p_paiement_confirme boolean default false
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_m public.naxa_delivery_missions%rowtype;
  v_allowed boolean:=false;
  v_role text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_statut in ('livreur_assigne','en_livraison','livree') then
    raise exception 'Cette étape doit être exécutée par le workflow Livreur sécurisé';
  end if;
  select * into v_r from public.reservations where id=p_id for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande introuvable'; end if;
  if not (public.is_admin() or public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE')) then
    raise exception 'Action non autorisée';
  end if;
  v_role:=public.naxa_business_function(v_user);
  if p_statut='acceptee' and not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Seul le Gestionnaire de stock peut confirmer une demande de livraison';
  end if;
  if p_paiement_confirme then
    if not exists(
      select 1 from public.ventes v join public.vente_paiements vp on vp.vente_id=v.id
      where v.reservation_id=v_r.id and v.pharmacie_id=v_r.pharmacie_id
        and v.statut='payee' and v.total_net=v_r.total+v_r.frais_livraison
        and vp.montant=v_r.total+v_r.frais_livraison
    ) then
      raise exception 'Paiement non confirmé : encaissez la commande et les frais de livraison via une transaction POS liée';
    end if;
  end if;
  v_allowed:=case
    when v_r.commande_statut='en_attente_pharmacie' then p_statut in ('acceptee','annulee')
    when v_r.commande_statut='acceptee' then p_statut in ('preparation','annulee')
    when v_r.commande_statut in ('preparation','livreur_assigne') then p_statut='annulee'
    else false end;
  if not v_allowed and p_statut is distinct from v_r.commande_statut then
    raise exception 'Transition de commande interdite';
  end if;
  if p_statut='annulee' then
    select * into v_m from public.naxa_delivery_missions where reservation_id=p_id for update;
    if found then
      if v_m.statut in ('accepted','picked_up','arrived','delivered') then
        raise exception 'Un livreur a déjà accepté cette commande. La pharmacie doit traiter la mission avec le réseau de livraison avant toute annulation.';
      end if;
      if v_m.statut='available' or v_m.statut='failed' then
        update public.naxa_delivery_missions set statut='cancelled',updated_at=now() where id=v_m.id;
        update public.naxa_delivery_mission_offers set offer_status='recalled'
        where mission_id=v_m.id and offer_status='offered';
        insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
        values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_user,'cancelled','Commande annulée par la pharmacie');
      end if;
    end if;
    if v_r.statut not in ('annulee','expiree','retiree') then
      perform private.set_reservation_status(p_id,'annulee'::public.resa_statut);
    end if;
  end if;
  if p_paiement_confirme and v_r.statut not in ('payee','retiree') then
    perform private.set_reservation_status(p_id,'payee'::public.resa_statut);
  end if;
  update public.reservations
  set commande_statut=p_statut,
      expires_at=case when p_statut in ('acceptee','preparation') and not p_paiement_confirme
        and v_r.paiement_statut<>'effectue' then now()+interval '100 years' else expires_at end
  where id=p_id;
  return true;
end;
$function$;
revoke all on function public.mettre_a_jour_commande_client(uuid,text,boolean) from public,anon;
grant execute on function public.mettre_a_jour_commande_client(uuid,text,boolean) to authenticated;

commit;
