-- Contrôles structurels en lecture seule des garde-fous Livreur / paiement NAXA.
DO $test$
DECLARE
  v_preparation_required boolean;
  v_index_count integer;
  v_item record;
  v_definition text;
BEGIN
  SELECT a.attnotnull INTO v_preparation_required
  FROM pg_attribute a
  WHERE a.attrelid='public.reservations'::regclass
    AND a.attname='preparation_statut'
    AND a.attnum>0
    AND NOT a.attisdropped;
  IF v_preparation_required IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'reservations.preparation_statut doit être NOT NULL';
  END IF;

  SELECT count(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname='public'
    AND indexname = ANY(ARRAY[
      'naxa_delivery_commission_pharmacie_month_idx',
      'naxa_delivery_commission_promoteur_month_idx',
      'naxa_delivery_commission_zone_idx',
      'naxa_delivery_events_actor_id_idx',
      'naxa_delivery_events_pharmacie_time_idx',
      'naxa_delivery_offers_pharmacie_status_time_idx',
      'naxa_delivery_offers_reservation_idx',
      'naxa_delivery_missions_ready_by_idx',
      'naxa_delivery_payment_caisse_session_idx',
      'naxa_delivery_payment_client_time_idx',
      'naxa_delivery_payment_declared_by_idx',
      'naxa_delivery_payment_livreur_time_idx',
      'naxa_delivery_payment_validated_by_idx',
      'naxa_delivery_reviews_client_time_idx',
      'naxa_livreur_invites_accepted_by_idx',
      'naxa_livreur_invites_assignment_idx',
      'naxa_livreur_invites_inviteur_time_idx',
      'naxa_livreur_invites_pharmacie_time_idx'
    ]);
  IF v_index_count <> 18 THEN
    RAISE EXCEPTION '18 index attendus, % présents', v_index_count;
  END IF;

  FOR v_item IN
    SELECT * FROM (VALUES
      ('public.naxa_delivery_make_available(uuid)'::regprocedure, 'paiement_mode is null'),
      ('public.naxa_delivery_accept(uuid)'::regprocedure, 'paiement_mode is null'),
      ('public.naxa_delivery_my_missions(boolean)'::regprocedure, 'paiement_mode is not null'),
      ('public.naxa_delivery_pickup(uuid,double precision,double precision,double precision)'::regprocedure, 'paiement_mode is null'),
      ('public.naxa_delivery_courier_declare_cash(uuid,integer)'::regprocedure, 'paiement_mode is distinct from'),
      ('public.naxa_delivery_pos_encaisser(uuid,uuid,integer,text,text,text)'::regprocedure, 'paiement_mode is distinct from'),
      ('public.gestionnaire_stock_commande_preparation(uuid,text)'::regprocedure, 'paiement_mode is null'),
      ('public.naxa_delivery_make_available_before_preparation_gate(uuid)'::regprocedure, 'paiement_mode is null'),
      ('private.naxa_delivery_driver_can_act(uuid,uuid)'::regprocedure, 'paiement_mode is not null'),
      ('private.naxa_delivery_finalize_if_confirmed(uuid)'::regprocedure, 'paiement_mode is null')
    ) AS expected(signature, fragment)
  LOOP
    v_definition := lower(pg_get_functiondef(v_item.signature));
    IF position(v_item.fragment in v_definition) = 0 THEN
      RAISE EXCEPTION 'Garde paiement absente dans %', v_item.signature;
    END IF;
  END LOOP;

  SELECT lower(pg_get_functiondef('private.naxa_delivery_finalize_if_confirmed(uuid)'::regprocedure))
  INTO v_definition;
  IF position('frais_livraison between 1500 and 3500' in v_definition)=0
     OR position('v_r.frais_livraison,500,v_r.frais_livraison-500' in v_definition)=0 THEN
    RAISE EXCEPTION 'Le plafond de livraison ou la commission fixe NAXA est incorrect';
  END IF;

  IF has_function_privilege('anon','public.naxa_delivery_make_available_before_preparation_gate(uuid)'::regprocedure,'EXECUTE')
     OR has_function_privilege('authenticated','public.naxa_delivery_make_available_before_preparation_gate(uuid)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('service_role','public.naxa_delivery_make_available_before_preparation_gate(uuid)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'ACL inattendue sur le helper de dispatch';
  END IF;
END
$test$;

SELECT true AS naxa_delivery_null_safe_payment_guards_pass;
