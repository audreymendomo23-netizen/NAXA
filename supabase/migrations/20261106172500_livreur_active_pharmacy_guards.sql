-- NAXA — refuser les missions lorsque la pharmacie n'est plus opérationnelle.
begin;

create or replace function private.naxa_delivery_driver_can_act(p_user uuid,p_mission uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_user is not null
    and exists (
      select 1 from public.naxa_delivery_missions m
      join public.profiles p on p.id=m.livreur_id and p.actif=true
      join public.pharmacies ph on ph.id=m.pharmacie_id and ph.actif=true and ph.archivee_le is null
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
    )
$function$;
revoke all on function private.naxa_delivery_driver_can_act(uuid,uuid) from public,anon,authenticated;

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
  if v_pharmacy is null
    or not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif=true and ph.archivee_le is null)
    or not exists (
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
    and (p_include_history or m.statut in ('available','accepted','picked_up','arrived'));
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_missions(boolean) from public,anon;
grant execute on function public.naxa_delivery_my_missions(boolean) to authenticated;

create or replace function public.naxa_delivery_accept(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
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
  if not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif=true and ph.archivee_le is null) then
    raise exception 'La pharmacie est suspendue ou archivée';
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
    raise exception 'Seul le poste Gestionnaire de stock ou Magasinier peut publier une livraison prête';
  end if;
  if v_r.commande_statut<>'preparation'
    or v_r.preparation_statut<>'prete_au_retrait'
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Stock doit avoir enregistré la préparation puis confirmé Prête pour livraison';
  end if;

  select * into v_m from public.naxa_delivery_missions where reservation_id=p_reservation for update;
  if found then
    if v_m.statut='cancelled' then raise exception 'Cette commande a été annulée et ne peut plus être republiée'; end if;
    if v_m.statut='failed' then raise exception 'Cette mission doit être réaffectée par la pharmacie avant une nouvelle publication'; end if;
    return v_m.id;
  end if;

  insert into public.naxa_delivery_missions(reservation_id,pharmacie_id,client_id,ready_by)
  values(v_r.id,v_r.pharmacie_id,v_r.client_id,v_uid)
  returning id into v_mission;

  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label
  ) values(v_mission,v_r.id,v_r.pharmacie_id,v_uid,'ready','Préparation Stock terminée · commande publiée pour livraison');

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_mission,v_r.id,v_r.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,'delivery_mission','Nouvelle livraison disponible',
    'Une commande préparée attend un livreur dans votre pharmacie.',v_r.id,v_mission
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  return v_mission;
end;
$function$;
revoke all on function public.naxa_delivery_make_available(uuid) from public,anon;
grant execute on function public.naxa_delivery_make_available(uuid) to authenticated;

create or replace function public.naxa_delivery_reoffer(p_mission uuid,p_note text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_role text;
begin
  if v_uid is null or p_note is null or length(trim(p_note))<5 or length(trim(p_note))>300 then
    raise exception 'Motif de réaffectation invalide';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found then raise exception 'Mission introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_m.pharmacie_id,'PHARMACIE') then raise exception 'Mission hors périmètre'; end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=v_m.pharmacie_id and ph.actif=true and ph.archivee_le is null) then
    raise exception 'La pharmacie est suspendue ou archivée';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('promoteur','pharmacie','gestionnaire_stock','magasinier','responsable') then
    raise exception 'Réaffectation réservée à la pharmacie ou au Promoteur';
  end if;
  if v_m.statut not in ('accepted','failed') or v_m.picked_up_at is not null then
    raise exception 'La mission ne peut être réouverte après le retrait du colis';
  end if;

  update public.naxa_delivery_mission_offers
  set offer_status='recalled'
  where mission_id=p_mission and offer_status in ('offered','accepted');

  update public.naxa_delivery_missions
  set livreur_id=null,statut='available',accepted_at=null,failed_at=null,
      failure_code=null,failure_note=null,updated_at=now()
  where id=p_mission;
  update public.reservations set commande_statut='preparation' where id=v_m.reservation_id;

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_m.id,v_m.reservation_id,v_m.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'reoffered','Mission remise à disposition des livreurs',trim(p_note));

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,'delivery_mission','Livraison remise à disposition',
    'Une livraison attend un livreur.',v_m.reservation_id,v_m.id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_reoffer(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_reoffer(uuid,text) to authenticated;

commit;
