-- SM-01 — vérifications structurelles de la suspension disciplinaire.
-- À exécuter uniquement dans un environnement de test après la migration 20261027020000.
begin;

do $test$
declare
  v_definition text;
  v_path text;
begin
  if to_regclass('public.promoteur_suspensions_disciplinaires') is null then
    raise exception 'SM-01.1 : table de suspension disciplinaire absente';
  end if;
  if to_regclass('public.promoteur_suspensions_disciplinaires_audit') is null then
    raise exception 'SM-01.2 : journal disciplinaire absent';
  end if;
  if to_regprocedure('public.admin_suspendre_promoteur_disciplinaire(uuid,text)') is null
     or to_regprocedure('public.admin_lever_suspension_promoteur(uuid,text)') is null then
    raise exception 'SM-01.3 : RPC de suspension/levée absentes';
  end if;

  select pg_get_functiondef('public.admin_suspendre_promoteur_disciplinaire(uuid,text)'::regprocedure)
    into v_definition;
  if position('auth.uid()' in v_definition) = 0
     or position('role::text = ''admin''' in v_definition) = 0
     or position('actif = true' in v_definition) = 0
     or position('promoteur_suspensions_disciplinaires_audit' in v_definition) = 0
     or position('notifications' in v_definition) = 0 then
    raise exception 'SM-01.4 : suspension sans contrôle admin, audit ou notification';
  end if;

  select pg_get_functiondef('public.admin_lever_suspension_promoteur(uuid,text)'::regprocedure)
    into v_definition;
  if position('auth.uid()' in v_definition) = 0
     or position('role::text = ''admin''' in v_definition) = 0
     or position('promoteur_suspensions_disciplinaires_audit' in v_definition) = 0 then
    raise exception 'SM-01.5 : levée non auditée ou non protégée';
  end if;

  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure)
    into v_definition;
  if position('naxa_pharmacie_sous_suspension' in v_definition) = 0 then
    raise exception 'SM-01.6 : disponibilité Marketplace non protégée';
  end if;

  select pg_get_functiondef('private.naxa_pharmacie_sous_suspension(uuid)'::regprocedure)
    into v_definition;
  if position('perimetre_apres' in v_definition) = 0
     or position('jsonb_array_elements' in v_definition) = 0 then
    raise exception 'SM-01.6b : le périmètre disciplinaire doit rester stable malgré une modification ultérieure des rattachements';
  end if;

  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure)
    into v_definition;
  if position('naxa_pharmacie_sous_suspension' in v_definition) = 0 then
    raise exception 'SM-01.7 : RPC directe de réservation non protégée';
  end if;

  if has_function_privilege('anon','public.admin_suspendre_promoteur_disciplinaire(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.admin_lever_suspension_promoteur(uuid,text)','EXECUTE') then
    raise exception 'SM-01.8 : anon ne doit pas suspendre ni lever une sanction';
  end if;

  select pg_get_functiondef('public.caisse_rechercher_produit(uuid,text,text)'::regprocedure)
    into v_definition;
  if position('stock_vendable_interne' in v_definition) = 0
     or position('marketplace_offre_stock_disponible' in v_definition) > 0 then
    raise exception 'SM-01.8b : la sanction Marketplace ne doit pas bloquer la recherche POS interne';
  end if;

  select pg_get_functiondef('public.admin_confirmer_reglement_promoteur(uuid,uuid)'::regprocedure)
    into v_definition;
  if position('promoteur_suspensions_disciplinaires' in v_definition) > 0 then
    raise exception 'SM-01.9 : le règlement commercial ne doit pas piloter l’état disciplinaire';
  end if;

  select array_to_string(proconfig, ',') into v_path
  from pg_proc where oid = 'public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure;
  if coalesce(v_path,'') not like '%search_path=%' then
    raise exception 'SM-01.10 : search_path sécurisé absent sur la disponibilité';
  end if;
end
$test$;

rollback;
