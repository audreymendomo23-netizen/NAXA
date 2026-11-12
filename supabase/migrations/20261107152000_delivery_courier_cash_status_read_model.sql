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
    'client_confirme_at',m.client_confirme_at,'livreur_confirme_at',m.livreur_confirme_at,
    'signature_client',m.signature_client_traces is not null,
    'livraison_demande_at',r.livraison_demande_at,
    'livraison_confirmee_stock_at',r.livraison_confirmee_stock_at,
    'livraison_depart_at',r.livraison_depart_at,
    'livraison_echeance_at',r.livraison_echeance_at,
    'duree_livraison_estimee_min',r.duree_livraison_estimee_min,
    'paiement_mode',r.paiement_mode,'paiement_statut',r.paiement_statut,
    'cash_payment_status',(select pr.status from public.naxa_delivery_payment_records pr where pr.reservation_id=r.id),
    'cash_received',(select pr.cash_received from public.naxa_delivery_payment_records pr where pr.reservation_id=r.id),
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
