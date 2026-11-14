-- NAXA security hardening contract (read-only).
-- Run after migration 20261105142000_security_hardening_public_catalog_and_helper_scopes.
BEGIN;

DO $test$
DECLARE
  v_def text;
  v_privdef text;
BEGIN
  -- Every table exposed through public must keep RLS enabled.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'A public table is missing RLS';
  END IF;

  -- There must be no unguarded PUBLIC/anon write policy.
  IF EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.cmd IN ('INSERT', 'UPDATE', 'ALL')
      AND ('public' = ANY(p.roles) OR 'anon' = ANY(p.roles))
      AND (lower(coalesce(p.with_check, '')) = 'true'
        OR (p.cmd IN ('UPDATE', 'ALL') AND lower(coalesce(p.qual, '')) = 'true'))
  ) THEN
    RAISE EXCEPTION 'An unguarded public/anon write policy exists';
  END IF;

  -- Public inventory endpoint is invoker-only; the private definer implementation
  -- contains the strict pharmacy visibility and non-expired / non-blocked lot filters.
  SELECT pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure)
  INTO v_privdef;
  SELECT pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure)
  INTO v_def;
  IF v_privdef NOT ILIKE '%ph.est_demo IS TRUE%'
     OR v_privdef NOT ILIKE '%ph.archivee_le IS NULL%'
     OR v_privdef NOT ILIKE '%coalesce(l.bloque%'
     OR v_privdef NOT ILIKE '%date_peremption%'
     OR v_privdef NOT ILIKE '%fiche_validee IS TRUE%'
     OR v_privdef NOT ILIKE '%marketplace_stock_last_quantity_update%'
     OR v_def ILIKE '%SECURITY DEFINER%'
     OR v_def NOT ILIKE '%private.marketplace_offre_stock_disponible_guarded%' THEN
    RAISE EXCEPTION 'Marketplace stock wrapper or private guard is invalid';
  END IF;

  -- The Bebe-Maman universe must use only publicly visible real pharmacies.
  SELECT pg_get_functiondef('private.get_universe_catalog(text)'::regprocedure)
  INTO v_privdef;
  SELECT pg_get_functiondef('public.get_universe_catalog(text)'::regprocedure)
  INTO v_def;
  IF v_privdef NOT ILIKE '%ph.est_demo IS FALSE%'
     OR v_privdef NOT ILIKE '%ph.archivee_le IS NULL%'
     OR v_privdef NOT ILIKE '%ph.visible_recherche IS TRUE%'
     OR v_def ILIKE '%SECURITY DEFINER%'
     OR v_def NOT ILIKE '%private.get_universe_catalog%' THEN
    RAISE EXCEPTION 'Universe catalogue wrapper or private guard is invalid';
  END IF;

  -- Public popular-products endpoint is invoker-only; the private function
  -- aggregates only public pharmacies.
  SELECT pg_get_functiondef('private.produits_populaires(integer,integer)'::regprocedure)
  INTO v_privdef;
  SELECT pg_get_functiondef('public.produits_populaires(integer,integer)'::regprocedure)
  INTO v_def;
  IF v_privdef NOT ILIKE '%ph.est_demo IS FALSE%'
     OR v_privdef NOT ILIKE '%ph.archivee_le IS NULL%'
     OR v_privdef NOT ILIKE '%ph.visible_recherche IS TRUE%'
     OR v_def ILIKE '%SECURITY DEFINER%'
     OR v_def NOT ILIKE '%private.produits_populaires%' THEN
    RAISE EXCEPTION 'Popular-products RPC is not isolated behind its filtered private implementation';
  END IF;

  -- The public cart-search endpoint is invoker-only and calls a filtered
  -- private implementation through a minimal EXECUTE allow-list.
  SELECT pg_get_functiondef('private.search_pharmacies_panier(jsonb,double precision,double precision,double precision)'::regprocedure)
  INTO v_privdef;
  SELECT pg_get_functiondef('public.search_pharmacies_panier(jsonb,double precision,double precision,double precision)'::regprocedure)
  INTO v_def;
  IF v_privdef NOT ILIKE '%ph.est_demo IS FALSE%'
     OR v_privdef NOT ILIKE '%ph.archivee_le IS NULL%'
     OR v_privdef NOT ILIKE '%ph.visible_recherche IS TRUE%'
     OR v_def ILIKE '%SECURITY DEFINER%'
     OR v_def NOT ILIKE '%private.search_pharmacies_panier%' THEN
    RAISE EXCEPTION 'Cart-search RPC is missing the filtered private boundary';
  END IF;

  -- Scope oracle must run with invoker rights and deny non-self profile checks
  -- (the private helper remains available for guarded internal paths).
  SELECT pg_get_functiondef('public.naxa_scope_allows(uuid,uuid,text)'::regprocedure)
  INTO v_def;
  IF v_def ILIKE '%SECURITY DEFINER%'
     OR v_def NOT ILIKE '%auth.uid%'
     OR v_def NOT ILIKE '%private.naxa_scope_allows%' THEN
    RAISE EXCEPTION 'Scope helper is not a caller-scoped invoker wrapper';
  END IF;

  -- Professional verification status must be private for cross-profile
  -- policy checks; the public RPC must be self/admin/service only.
  SELECT pg_get_functiondef('private.suivi_is_verified_professional(uuid)'::regprocedure)
  INTO v_privdef;
  SELECT pg_get_functiondef('public.suivi_is_verified_professional(uuid)'::regprocedure)
  INTO v_def;
  IF v_privdef NOT ILIKE '%verified IS TRUE%'
     OR v_def ILIKE '%SECURITY DEFINER%'
     OR v_def NOT ILIKE '%auth.uid%'
     OR v_def NOT ILIKE '%private.suivi_is_verified_professional%' THEN
    RAISE EXCEPTION 'Professional verification helper is not safely scoped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='suivi_shares'
      AND policyname='suivi_shares_owner_insert'
      AND with_check ILIKE '%private.suivi_is_verified_professional(recipient_user_id)%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='suivi_shares'
      AND policyname='suivi_shares_owner_update'
      AND with_check ILIKE '%private.suivi_is_verified_professional(recipient_user_id)%'
  ) THEN
    RAISE EXCEPTION 'Share policies must check recipient verification through private helper';
  END IF;

  -- Public catalog RPCs keep only the explicit API grants; sensitive helper
  -- RPCs are not exposed to anon.
  IF has_function_privilege('anon', 'public.naxa_scope_allows(uuid,uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.suivi_is_verified_professional(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'An anonymous role can execute a sensitive helper RPC';
  END IF;

  IF NOT has_function_privilege('anon', 'public.marketplace_offre_stock_disponible(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.get_universe_catalog(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.produits_populaires(integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.search_pharmacies_panier(jsonb,double precision,double precision,double precision)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A public catalogue RPC lost its explicit anon grant';
  END IF;


  -- All remaining public catalogue SECURITY DEFINER code must live behind
  -- invoker wrappers. This prevents anon/authenticated RPCs from executing
  -- privileged public-schema functions directly.
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.get_home_service_catalog()'::regprocedure)
     OR (SELECT prosecdef FROM pg_proc WHERE oid='public.universe_partner_is_public(uuid,text)'::regprocedure) THEN
    RAISE EXCEPTION 'A public catalogue wrapper still uses SECURITY DEFINER';
  END IF;
  IF has_function_privilege('anon','private.naxa_business_function(uuid)','EXECUTE')
     OR has_function_privilege('anon','private.naxa_active_role_pharmacy(uuid)','EXECUTE')
     OR has_function_privilege('anon','private.naxa_scope_allows(uuid,uuid,text)','EXECUTE')
     OR has_function_privilege('anon','private.suivi_is_verified_professional(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'An anonymous role can execute an internal private helper';
  END IF;
  IF NOT has_function_privilege('anon','private.produits_populaires(integer,integer)','EXECUTE')
     OR NOT has_function_privilege('anon','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('anon','private.get_universe_catalog(text)','EXECUTE')
     OR NOT has_function_privilege('anon','private.get_home_service_catalog()','EXECUTE')
     OR NOT has_function_privilege('anon','private.universe_partner_is_public(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'The anonymous private-helper allow-list is incomplete';
  END IF;

  -- Public role/scope lookup RPCs may answer only for the caller's own profile.
  SELECT pg_get_functiondef('public.naxa_business_function(uuid)'::regprocedure) INTO v_def;
  IF v_def ILIKE '%SECURITY DEFINER%' OR v_def NOT ILIKE '%auth.uid%'
     OR v_def NOT ILIKE '%private.naxa_business_function%' THEN
    RAISE EXCEPTION 'Public role helper is not caller-scoped invoker code';
  END IF;
  SELECT pg_get_functiondef('public.naxa_active_role_pharmacy(uuid)'::regprocedure) INTO v_def;
  IF v_def ILIKE '%SECURITY DEFINER%' OR v_def NOT ILIKE '%auth.uid%'
     OR v_def NOT ILIKE '%private.naxa_active_role_pharmacy%' THEN
    RAISE EXCEPTION 'Public active-role helper is not caller-scoped invoker code';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.prokind='f'
      AND (p.prosrc ~* 'public[.]naxa_business_function[[:space:]]*[(]'
        OR p.prosrc ~* 'public[.]naxa_active_role_pharmacy[[:space:]]*[(]')
      AND NOT (n.nspname='public' AND p.proname IN ('naxa_business_function','naxa_active_role_pharmacy','naxa_scope_allows'))
  ) THEN
    RAISE EXCEPTION 'An internal routine still calls the public cross-profile helper';
  END IF;

  -- Behavioural regression guard: if public-active demo/archived pharmacies
  -- have stock, none of their stock may escape through public offer/cart RPCs.
  IF EXISTS (
    SELECT 1
    FROM public.stocks s
    JOIN public.pharmacies ph ON ph.id=s.pharmacie_id
    WHERE ph.actif IS TRUE
      AND ph.visible_recherche IS TRUE
      AND (ph.est_demo IS TRUE OR ph.archivee_le IS NOT NULL)
      AND s.quantite > 0
      AND EXISTS (
        SELECT 1
        FROM public.marketplace_offre_stock_disponible(ph.id, s.produit_id)
      )
  ) THEN
    RAISE EXCEPTION 'Marketplace RPC returned an offer from a demo/archived pharmacy';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pharmacies ph
    JOIN LATERAL (
      SELECT s.produit_id
      FROM public.stocks s
      WHERE s.pharmacie_id=ph.id AND s.quantite > 0
      ORDER BY s.produit_id
      LIMIT 1
    ) product ON TRUE
    CROSS JOIN LATERAL public.search_pharmacies_panier(
      jsonb_build_array(jsonb_build_object('produit_id', product.produit_id, 'quantite', 1)),
      ph.lat, ph.lng, 100
    ) result
    WHERE ph.actif IS TRUE
      AND ph.visible_recherche IS TRUE
      AND (ph.est_demo IS TRUE OR ph.archivee_le IS NOT NULL)
      AND result.pharmacie_id=ph.id
  ) THEN
    RAISE EXCEPTION 'Cart-search RPC returned a demo/archived pharmacy';
  END IF;
END
$test$;

ROLLBACK;
