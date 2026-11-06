-- NAXA — correction de compatibilité et garde d'activité des livreurs.
begin;

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
    and (p_include_history or m.statut in ('available','accepted','picked_up','arrived'));
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
  select p_user is not null
    and exists (
      select 1 from public.naxa_delivery_missions m
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
    )
$function$;
revoke all on function private.naxa_delivery_driver_can_act(uuid,uuid) from public,anon,authenticated;

create or replace function public.naxa_delivery_pickup(
  p_mission uuid,p_latitude double precision default null,p_longitude double precision default null,p_accuracy_m double precision default null
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut<>'accepted' then
    raise exception 'Seul le livreur actif affecté peut retirer cette commande';
  end if;
  if (p_latitude is null)<>(p_longitude is null)
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180))
    or (p_accuracy_m is not null and p_accuracy_m not between 0 and 10000) then
    raise exception 'Position GPS invalide';
  end if;
  update public.naxa_delivery_missions set statut='picked_up',picked_up_at=now(),updated_at=now() where id=p_mission;
  update public.reservations set commande_statut='en_livraison' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude,accuracy_m
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'picked_up','Commande récupérée à la pharmacie',p_latitude,p_longitude,p_accuracy_m);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_pickup(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_pickup(uuid,double precision,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_add_location(
  p_mission uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision default null
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_last timestamptz;
begin
  if v_uid is null or p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
    or (p_accuracy_m is not null and p_accuracy_m not between 0 and 10000) then
    raise exception 'Coordonnées de position invalides';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Position non autorisée : vérifiez le poste Livreur actif et la mission';
  end if;
  select max(e.created_at) into v_last from public.naxa_delivery_events e
  where e.mission_id=p_mission and e.event_type='location';
  if v_last is not null and v_last>now()-interval '10 seconds' then
    raise exception 'Patientez avant de partager une nouvelle position';
  end if;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude,accuracy_m
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'location','Position du livreur',p_latitude,p_longitude,p_accuracy_m);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_add_location(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_add_location(uuid,double precision,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_arrived(
  p_mission uuid,p_latitude double precision default null,p_longitude double precision default null
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut<>'picked_up' then
    raise exception 'Le livreur actif doit avoir récupéré la commande avant de signaler son arrivée';
  end if;
  if (p_latitude is null)<>(p_longitude is null)
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then
    raise exception 'Position GPS invalide';
  end if;
  update public.naxa_delivery_missions set statut='arrived',arrived_at=now(),updated_at=now() where id=p_mission;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'arrived','Livreur arrivé à destination',p_latitude,p_longitude);
  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_m.client_id,v_m.pharmacie_id,'delivery_arrived','Votre livreur est arrivé',
    'Veuillez confirmer la réception de votre commande dans NAXA.',v_m.reservation_id,v_m.id);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_arrived(uuid,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_arrived(uuid,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_report_issue(p_mission uuid,p_code text,p_note text default null)
returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if p_code not in ('client_absent','adresse_introuvable','client_injoignable','incident_route','commande_endommagee','autre')
    or length(coalesce(p_note,''))>500 then raise exception 'Motif de difficulté invalide'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Cette mission ne peut pas recevoir de signalement';
  end if;
  update public.naxa_delivery_missions
  set statut='failed',failed_at=now(),failure_code=p_code,failure_note=nullif(trim(p_note),''),updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'failed','Incident de livraison signalé',
    jsonb_build_object('code',p_code,'note',nullif(trim(p_note),''))::text);
  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_m.client_id,v_m.pharmacie_id,'delivery_issue','Difficulté pendant la livraison',
    'Le livreur a signalé une difficulté. La pharmacie doit organiser la suite.',v_m.reservation_id,v_m.id);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_report_issue(uuid,text,text) from public,anon;
grant execute on function public.naxa_delivery_report_issue(uuid,text,text) to authenticated;

commit;
