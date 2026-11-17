-- Lot B1 : passage Stock -> Livreur après préparation physique confirmée.
-- Replay uniquement : naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- Commandes, missions, offres, événements et notifications annulés par ROLLBACK.
begin;

do $$
declare
  v_client uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_order uuid;
begin
  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,commande_statut,livraison_demande_at,
    livraison_confirmee_stock_at,stock_decremented,stock_restored
  ) values (
    v_client,'76dd4983-273a-4a83-ae3d-9a7838d3aa35','confirmee',1000,
    now()+interval '3 hours','commande','a_verifier','especes_livraison',
    'acceptee',now(),now(),false,false
  ) returning id into v_order;

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_order,'dfd7313c-46a4-455a-b67d-50f0ce2a3686',1,1000);

  perform set_config('naxa.test.order',v_order::text,true);
end
$$;

-- Le Gestionnaire de stock démarre et confirme la préparation.
select set_config(
  'request.jwt.claim.sub',
  '5f03b180-2605-4de4-8161-f719ce24ae82',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"5f03b180-2605-4de4-8161-f719ce24ae82","role":"authenticated"}',
  true
);
set local role authenticated;
select public.gestionnaire_stock_commande_preparation(
  current_setting('naxa.test.order')::uuid,'en_preparation'
);
select public.gestionnaire_stock_commande_preparation(
  current_setting('naxa.test.order')::uuid,'prete_au_retrait'
);
reset role;

do $$
declare
  v_mission uuid;
begin
  select id into v_mission
  from public.naxa_delivery_missions
  where reservation_id=current_setting('naxa.test.order')::uuid;
  if v_mission is null then raise exception 'B1_DELIVERY_MISSION_NOT_PUBLISHED_AFTER_STOCK_READY'; end if;
  perform set_config('naxa.test.mission',v_mission::text,true);
end
$$;

-- Le compte Livreur n'accepte qu'une mission publiée après la préparation.
select set_config(
  'request.jwt.claim.sub',
  'f5d02d2b-2286-4dac-becc-f13ba84d78ad',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"f5d02d2b-2286-4dac-becc-f13ba84d78ad","role":"authenticated"}',
  true
);
set local role authenticated;
select public.naxa_delivery_accept(current_setting('naxa.test.mission')::uuid);
reset role;

do $$
declare
  v_status text;
  v_courier uuid;
  v_order_status text;
  v_offer_status text;
begin
  select statut,livreur_id into v_status,v_courier
  from public.naxa_delivery_missions
  where id=current_setting('naxa.test.mission')::uuid;

  select commande_statut into v_order_status
  from public.reservations
  where id=current_setting('naxa.test.order')::uuid;

  select offer_status into v_offer_status
  from public.naxa_delivery_mission_offers
  where mission_id=current_setting('naxa.test.mission')::uuid
    and livreur_id='f5d02d2b-2286-4dac-becc-f13ba84d78ad';

  if v_status<>'accepted'
     or v_courier<>'f5d02d2b-2286-4dac-becc-f13ba84d78ad'
     or v_order_status<>'livreur_assigne'
     or v_offer_status<>'accepted' then
    raise exception 'B1_STOCK_TO_COURIER_HANDOFF_FAIL mission=% courier=% order=% offer=%',
      v_status,v_courier,v_order_status,v_offer_status;
  end if;
end
$$;

select 'LOT_B1_STOCK_READY_TO_COURIER_ACCEPTANCE PASS' as result;
rollback;
