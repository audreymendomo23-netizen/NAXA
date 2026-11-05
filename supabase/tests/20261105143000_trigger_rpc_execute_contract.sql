-- NAXA security contract: internal trigger RPCs and retired endpoints.
-- Read-only assertions; run after migration 20261105142000.
BEGIN;

DO $test$
BEGIN
  IF has_function_privilege('anon','public.initialiser_abonnement_pharmacie()','EXECUTE')
     OR has_function_privilege('authenticated','public.initialiser_abonnement_pharmacie()','EXECUTE')
     OR has_function_privilege('anon','public.vente_ligne_figer_cout()','EXECUTE')
     OR has_function_privilege('authenticated','public.vente_ligne_figer_cout()','EXECUTE')
     OR has_function_privilege('anon','public.produits_garde_fiche()','EXECUTE')
     OR has_function_privilege('authenticated','public.produits_garde_fiche()','EXECUTE')
     OR has_function_privilege('anon','public.naxa_reservation_receipt_snapshot()','EXECUTE')
     OR has_function_privilege('authenticated','public.naxa_reservation_receipt_snapshot()','EXECUTE') THEN
    RAISE EXCEPTION 'A trigger-only function remains executable as a client RPC';
  END IF;

  IF has_function_privilege('anon','public.client_credit_rembourser(uuid,integer,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.client_credit_rembourser(uuid,integer,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'The retired free-text refund RPC remains executable';
  END IF;

  IF has_function_privilege('anon','public.naxa_architecture_for_profile(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.naxa_architecture_for_profile(uuid)','EXECUTE')
     OR (SELECT prosecdef FROM pg_proc WHERE oid='public.naxa_architecture_for_profile(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'Internal promoter architecture lookup is still exposed or definer';
  END IF;

  IF has_function_privilege('anon','public.is_promoteur()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.is_promoteur()','EXECUTE') THEN
    RAISE EXCEPTION 'Promoter identity helper must be authenticated-only';
  END IF;

  IF NOT has_function_privilege('anon','public.log_recherche(text[])','EXECUTE')
     OR NOT has_function_privilege('anon','public.log_evenement(text,uuid,uuid,text,integer,double precision,double precision)','EXECUTE') THEN
    RAISE EXCEPTION 'Public search/event telemetry RPCs lost their guest grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_produits_garde' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_vente_ligne_figer_cout' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_naxa_reservation_receipt_snapshot' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_initialiser_abonnement_pharmacie' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'A business trigger was accidentally removed';
  END IF;
END
$test$;

ROLLBACK;
