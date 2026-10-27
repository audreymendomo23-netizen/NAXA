-- SM-01 point 3 — inventaire structurel des RPC stock et synchronisation hors ligne.
-- À exécuter uniquement dans une base de test hors production après les migrations.
begin;
do $test$
declare
  v_definition text;
  v_proc regprocedure;
begin
  -- Ajustements de stock : rôle actif, périmètre et privilèges RPC.
  v_proc := to_regprocedure('public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)');
  if v_proc is null then raise exception 'SM-01.3.STOCK.1 : RPC ajustement stock absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('naxa_scope_allows' in v_definition)=0
     or position('actif=true' in v_definition)=0 then
    raise exception 'SM-01.3.STOCK.2 : garde identité/périmètre/compte actif absente de l’ajustement';
  end if;
  if has_function_privilege('anon',v_proc,'EXECUTE')
     or has_function_privilege('public',v_proc,'EXECUTE') then
    raise exception 'SM-01.3.STOCK.3 : ajustement stock exécutable par anon/public';
  end if;

  -- Transferts : le même acteur doit être autorisé dans les deux pharmacies.
  v_proc := to_regprocedure('public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)');
  if v_proc is null then raise exception 'SM-01.3.STOCK.4 : RPC transfert atomique absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('naxa_scope_allows' in v_definition)=0
     or position('p_source' in v_definition)=0
     or position('p_destination' in v_definition)=0
     or position('actif=true' in v_definition)=0 then
    raise exception 'SM-01.3.STOCK.5 : contrôle des deux périmètres absent du transfert';
  end if;
  if has_function_privilege('anon',v_proc,'EXECUTE')
     or has_function_privilege('public',v_proc,'EXECUTE') then
    raise exception 'SM-01.3.STOCK.6 : transfert stock exécutable par anon/public';
  end if;

  -- Synchronisation hors ligne : idempotence, compte propriétaire et portée serveur.
  v_proc := to_regprocedure('public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)');
  if v_proc is null then raise exception 'SM-01.3.STOCK.7 : RPC de synchronisation offline absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('created_by' in v_definition)=0
     or position('naxa_has_active_professional_assignment' in v_definition)=0
     or position('base_updated_at' in v_definition)=0 then
    raise exception 'SM-01.3.STOCK.8 : identité, idempotence, affectation ou contrôle de conflit absent';
  end if;
  if has_function_privilege('anon',v_proc,'EXECUTE')
     or has_function_privilege('public',v_proc,'EXECUTE') then
    raise exception 'SM-01.3.STOCK.9 : synchronisation offline exécutable par anon/public';
  end if;

  -- L'ancienne API à identifiant d'appareil est réservée au service_role.
  v_proc := to_regprocedure('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)');
  if v_proc is null then raise exception 'SM-01.3.STOCK.10 : RPC offline v1 absente'; end if;
  if has_function_privilege('anon',v_proc,'EXECUTE')
     or has_function_privilege('authenticated',v_proc,'EXECUTE')
     or not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'SM-01.3.STOCK.11 : RPC offline v1 accessible hors service_role';
  end if;

  -- La prise de service doit refuser les profils absents/inactifs et les pharmacies hors scope.
  v_proc := to_regprocedure('public.stock_service_open(uuid,text)');
  if v_proc is null then raise exception 'SM-01.3.STOCK.12 : RPC ouverture service stock absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('actif' in v_definition)=0
     or position('naxa_scope_allows' in v_definition)=0 then
    raise exception 'SM-01.3.STOCK.13 : ouverture service stock sans garde identité/actif/périmètre';
  end if;
end
$test$;
rollback;
