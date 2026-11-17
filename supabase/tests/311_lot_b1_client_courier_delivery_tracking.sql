-- Lot B1/B2 : livraison complète après préparation Stock, acceptation Livreur,
-- retrait, arrivée et double confirmation Client/Livreur.
-- Replay uniquement : naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- Commande, mission, offres, événements et notifications annulés par ROLLBACK.
begin;

do $$
declare
  v_order uuid;
begin
  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,commande_statut,livraison_demande_at,
    livraison_confirmee_stock_at,stock_decremented,stock_restored
  ) values (
    'dcb2242b-50fb-46c8-8c90-e01d42fa4175',
    '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
    'confirmee',1000,now()+interval '3 hours','commande','effectue',
    'especes_livraison','acceptee',now(),now(),false,false
  ) returning id into v_order;

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_order,'dfd7313c-46a4-455a-b67d-50f0ce2a3686',1,1000);

  perform set_config('naxa.test.order',v_order::text,true);
end
$$;

-- Stock : préparation physique puis publication de la mission.
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
  if v_mission is null then raise exception 'B1_DELIVERY_MISSION_NOT_CREATED'; end if;
  perform set_config('naxa.test.mission',v_mission::text,true);
end
$$;

-- Livreur : acceptation, retrait, arrivée et confirmation de remise.
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
select public.naxa_delivery_pickup(current_setting('naxa.test.mission')::uuid,null,null,null);
select public.naxa_delivery_arrived(current_setting('naxa.test.mission')::uuid,null,null);
select public.naxa_delivery_confirm_handover(current_setting('naxa.test.mission')::uuid);
reset role;

-- Client : confirmation de réception et lecture de son propre suivi.
select set_config(
  'request.jwt.claim.sub',
  'dcb2242b-50fb-46c8-8c90-e01d42fa4175',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"dcb2242b-50fb-46c8-8c90-e01d42fa4175","role":"authenticated"}',
  true
);
set local role authenticated;
select public.naxa_delivery_confirm_received(
  current_setting('naxa.test.mission')::uuid,
  'Réception test client'
);

do $$
declare
  v_tracking jsonb;
  v_status text;
  v_order_status text;
begin
  v_tracking := public.naxa_delivery_tracking(
    current_setting('naxa.test.order')::uuid
  );
  v_status := v_tracking->>'statut';

  select commande_statut into v_order_status
  from public.reservations
  where id=current_setting('naxa.test.order')::uuid;

  if v_status<>'delivered'
     or v_order_status<>'livree'
     or jsonb_array_length(v_tracking->'events')<5 then
    raise exception 'B1_DELIVERY_TRACKING_FINAL_STATE_FAIL status=% order=% events=%',
      v_status,v_order_status,jsonb_array_length(v_tracking->'events');
  end if;
end
$$;

select 'LOT_B1_CLIENT_COURIER_DELIVERY_TRACKING_TO_DELIVERED PASS' as result;
rollback;
