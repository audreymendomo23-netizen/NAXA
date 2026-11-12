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
    'client_confirme_at',m.client_confirme_at,
    'livreur_confirme_at',m.livreur_confirme_at,
    'signature_client',m.signature_client_traces is not null,
    'livraison_depart_at',r.livraison_depart_at,
    'livraison_echeance_at',r.livraison_echeance_at,
    'duree_livraison_estimee_min',r.duree_livraison_estimee_min,
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
    and (
      m.livreur_id=v_uid
      or (
        m.statut='available'
        and exists(
          select 1 from public.naxa_professional_assignments a
          where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy
            and a.role_code='livreur' and a.statut='active'
            and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now())
        )
      )
    )
    and (p_include_history or m.statut in ('available','accepted','picked_up','arrived'));
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_missions(boolean) from public,anon;
grant execute on function public.naxa_delivery_my_missions(boolean) to authenticated;

create or replace function public.naxa_delivery_pharmacy_tracking(p_reservation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation and mode='commande';
  if not found then return null; end if;
  if not public.is_admin() and not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Suivi hors périmètre pharmacie';
  end if;
  select * into v_m from public.naxa_delivery_missions
  where reservation_id=p_reservation;
  if not found then return null; end if;

  select jsonb_build_object(
    'mission_id',v_m.id,'statut',v_m.statut,'ready_at',v_m.ready_at,
    'accepted_at',v_m.accepted_at,'picked_up_at',v_m.picked_up_at,
    'arrived_at',v_m.arrived_at,'delivered_at',v_m.delivered_at,
    'client_confirme_at',v_m.client_confirme_at,
    'livreur_confirme_at',v_m.livreur_confirme_at,
    'signature_client',v_m.signature_client_traces is not null,
    'livraison_depart_at',v_r.livraison_depart_at,
    'livraison_echeance_at',v_r.livraison_echeance_at,
    'latitude_destination',v_r.latitude_livraison,
    'longitude_destination',v_r.longitude_livraison,
    'latitude_pharmacie',ph.lat,
    'longitude_pharmacie',ph.lng,
    'livreur',case when v_m.livreur_id is null then null else (
      select jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'username',p.username)
      from public.profiles p where p.id=v_m.livreur_id
    ) end,
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_type',e.event_type,'label',e.label,'detail',e.detail,
        'latitude',e.latitude,'longitude',e.longitude,'created_at',e.created_at
      ) order by e.created_at,e.id)
      from public.naxa_delivery_events e where e.mission_id=v_m.id
    ),'[]'::jsonb)
  ) into v_result
  from public.pharmacies ph where ph.id=v_m.pharmacie_id;
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_pharmacy_tracking(uuid) from public,anon;
grant execute on function public.naxa_delivery_pharmacy_tracking(uuid) to authenticated;

commit;
