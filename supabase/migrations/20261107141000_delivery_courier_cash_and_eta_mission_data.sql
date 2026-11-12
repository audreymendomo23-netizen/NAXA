begin;

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
      livraison_paiement_demande_at=coalesce(livraison_paiement_demande_at,now()),
      expires_at=greatest(coalesce(expires_at,now()),now()+interval '72 hours')
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
    'client_confirme_at',m.client_confirme_at,'livreur_confirme_at',m.livreur_confirme_at,
    'signature_client',m.signature_client_traces is not null,
    'livraison_demande_at',r.livraison_demande_at,
    'livraison_confirmee_stock_at',r.livraison_confirmee_stock_at,
    'livraison_depart_at',r.livraison_depart_at,
    'livraison_echeance_at',r.livraison_echeance_at,
    'duree_livraison_estimee_min',r.duree_livraison_estimee_min,
    'paiement_mode',r.paiement_mode,'paiement_statut',r.paiement_statut,
    'paiement_reference',case when m.livreur_id=v_uid then r.paiement_ref else null end,
    'failure_code',m.failure_code,'failure_note',m.failure_note,
    'commande_statut',r.commande_statut,'total',r.total,
    'frais_livraison',r.frais_livraison,'montant_a_encaisser',r.total+r.frais_livraison,
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

commit;
