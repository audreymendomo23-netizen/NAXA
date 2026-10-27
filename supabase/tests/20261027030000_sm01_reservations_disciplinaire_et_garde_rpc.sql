-- SM-01 points 2/3 — vérifications structurelles annulation et garde RPC.
-- À exécuter uniquement hors production après application de la migration 20261027030000.
begin;
do $test$
declare
  v_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservations'
      and column_name='preparation_statut'
  ) then raise exception 'SM-01.2.1 : état persistant de préparation absent'; end if;

  if to_regclass('public.reservation_suspension_disciplinaire_audit') is null then
    raise exception 'SM-01.2.2 : audit annulation disciplinaire absent';
  end if;

  if to_regprocedure('public.gestionnaire_stock_reservation_preparation(uuid,text)') is null then
    raise exception 'SM-01.2.3 : RPC de préparation absente';
  end if;

  select pg_get_functiondef('private.naxa_annuler_reservations_suspendues()'::regprocedure)
    into v_definition;
  if position('en_attente' in v_definition)=0
     or position('en_preparation' in v_definition)=0
     or position('prete_au_retrait' in v_definition)=0
     or position('payee' in v_definition)=0
     or position('retiree' in v_definition)=0
     or position('reservation_suspension_disciplinaire_audit' in v_definition)=0
     or position('public.restore_stock' in v_definition)=0
     or position('notifications' in v_definition)=0 then
    raise exception 'SM-01.2.4 : garde de suspension incomplète (statuts, restitution, audit ou notification)';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='naxa_suspension_disciplinaire_annuler_reservations'
      and not tgisinternal
  ) then raise exception 'SM-01.2.5 : déclencheur transactionnel de suspension absent'; end if;

  select pg_get_functiondef('public.gestionnaire_stock_reservation_preparation(uuid,text)'::regprocedure)
    into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('naxa_scope_allows' in v_definition)=0
     or position('actif=true' in v_definition)=0
     or position('prete_au_retrait' in v_definition)=0 then
    raise exception 'SM-01.3.1 : RPC de préparation sans contrôle d’identité, périmètre ou état';
  end if;

  select pg_get_functiondef('public.gestionnaire_stock_reservation_annuler(uuid)'::regprocedure)
    into v_definition;
  if position('prete_au_retrait' in v_definition)=0
     or position('naxa_scope_allows' in v_definition)=0
     or position('public.restore_stock' in v_definition)=0 then
    raise exception 'SM-01.3.2 : RPC directe d’annulation non protégée';
  end if;

  if has_function_privilege('anon','public.gestionnaire_stock_reservation_preparation(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_reservation_annuler(uuid)','EXECUTE') then
    raise exception 'SM-01.3.3 : anon ne doit pas exécuter les RPC de préparation/annulation';
  end if;

  -- Inventaire SM-01.3 : les RPC qui acceptent un acteur en paramètre doivent
  -- rester réservées au service_role et être appelées par des Server Actions protégées.
  if to_regprocedure('public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)') is null then
    raise exception 'SM-01.3.4 : RPC de soumission de règlement absente';
  end if;
  if has_function_privilege('anon','public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)','EXECUTE')
     or has_function_privilege('authenticated','public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)','EXECUTE')
     or not has_function_privilege('service_role','public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)','EXECUTE') then
    raise exception 'SM-01.3.5 : la soumission de règlement doit être exécutable uniquement via service_role';
  end if;

  if to_regprocedure('public.admin_confirmer_reglement_promoteur(uuid,uuid)') is null then
    raise exception 'SM-01.3.6 : RPC de confirmation de règlement absente';
  end if;
  if has_function_privilege('anon','public.admin_confirmer_reglement_promoteur(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_confirmer_reglement_promoteur(uuid,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.admin_confirmer_reglement_promoteur(uuid,uuid)','EXECUTE') then
    raise exception 'SM-01.3.7 : confirmation de règlement accessible hors service_role';
  end if;

  select pg_get_functiondef('public.admin_suspendre_promoteur_disciplinaire(uuid,text)'::regprocedure)
    into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('actif' in v_definition)=0
     or position('role' in v_definition)=0 then
    raise exception 'SM-01.3.8 : suspension disciplinaire sans garde d’identité/admin actif';
  end if;

end
$test$;
rollback;
