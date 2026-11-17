-- Lot B1 : préparation de plusieurs commandes et publication des missions aux livreurs.
-- Replay uniquement : naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- Les commandes, missions, offres et notifications sont annulées par ROLLBACK.
begin;

-- Deux commandes de recette déjà acceptées, paiement à la livraison choisi,
-- demande et contrôle Stock présents. Les lignes restent isolées de toute vente réelle.
do $$
declare
  v_client uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_order_1 uuid;
  v_order_2 uuid;
begin
  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,commande_statut,livraison_demande_at,
    livraison_confirmee_stock_at,stock_decremented,stock_restored
  ) values (
    v_client,'76dd4983-273a-4a83-ae3d-9a7838d3aa35','confirmee',1000,
    now()+interval '3 hours','commande','a_verifier','especes_livraison',
    'acceptee',now(),now(),false,false
  ) returning id into v_order_1;

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_order_1,'dfd7313c-46a4-455a-b67d-50f0ce2a3686',1,1000);

  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,commande_statut,livraison_demande_at,
    livraison_confirmee_stock_at,stock_decremented,stock_restored
  ) values (
    v_client,'76dd4983-273a-4a83-ae3d-9a7838d3aa35','confirmee',1000,
    now()+interval '3 hours','commande','a_verifier','especes_livraison',
    'acceptee',now(),now(),false,false
  ) returning id into v_order_2;

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_order_2,'dfd7313c-46a4-455a-b67d-50f0ce2a3686',1,1000);

  perform set_config('naxa.test.order1',v_order_1::text,true);
  perform set_config('naxa.test.order2',v_order_2::text,true);
end
$$;

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

-- Le Gestionnaire démarre puis clôt la préparation de deux commandes distinctes.
select public.gestionnaire_stock_commande_preparation(
  current_setting('naxa.test.order1')::uuid,'en_preparation'
);
select public.gestionnaire_stock_commande_preparation(
  current_setting('naxa.test.order2')::uuid,'en_preparation'
);
select public.gestionnaire_stock_commande_preparation(
  current_setting('naxa.test.order1')::uuid,'prete_au_retrait'
);
select public.gestionnaire_stock_commande_preparation(
  current_setting('naxa.test.order2')::uuid,'prete_au_retrait'
);

reset role;

do $$
declare
  v_missions integer;
  v_offers integer;
  v_ready integer;
begin
  select count(*) into v_missions
  from public.naxa_delivery_missions
  where reservation_id in (
    current_setting('naxa.test.order1')::uuid,
    current_setting('naxa.test.order2')::uuid
  );

  select count(*) into v_offers
  from public.naxa_delivery_mission_offers
  where reservation_id in (
    current_setting('naxa.test.order1')::uuid,
    current_setting('naxa.test.order2')::uuid
  ) and livreur_id='f5d02d2b-2286-4dac-becc-f13ba84d78ad';

  select count(*) into v_ready
  from public.reservations
  where id in (
    current_setting('naxa.test.order1')::uuid,
    current_setting('naxa.test.order2')::uuid
  ) and preparation_statut='prete_au_retrait';

  if v_missions<>2 or v_offers<>2 or v_ready<>2 then
    raise exception 'B1_MULTI_ORDER_READY_DELIVERY_OFFER_FAIL missions=% offers=% ready=%',
      v_missions,v_offers,v_ready;
  end if;
end
$$;

select 'LOT_B1_MULTI_ORDER_PREPARATION_READY_AND_COURIER_OFFERS PASS' as result;
rollback;
