-- NAXA 239 — contrôles structurels du ticket client et de l'ordonnanceur unifié.
-- À exécuter uniquement après la migration correspondante, sur une base de test.
begin;
do $test$
declare
  v_definition text;
  v_jobs integer;
begin
  if to_regprocedure('public.get_client_reservation_ticket(uuid)') is null then
    raise exception 'RPC ticket client absente';
  end if;
  if not has_function_privilege('authenticated','public.get_client_reservation_ticket(uuid)','EXECUTE') then
    raise exception 'Le client authentifié ne peut pas lire son ticket';
  end if;
  if has_function_privilege('anon','public.get_client_reservation_ticket(uuid)','EXECUTE') then
    raise exception 'La RPC ticket client est exécutable anonymement';
  end if;
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_client_reservation_ticket';
  if position('r.client_id = auth.uid()' in v_definition)=0 then
    raise exception 'La RPC ticket ne vérifie pas la propriété client';
  end if;
  if position('v.reservation_id = v_res.id' in v_definition)=0
     or position('v.statut::text = ''payee''' in v_definition)=0 then
    raise exception 'Le ticket n’est pas relié à une vente POS payée de la réservation';
  end if;
  if position('paiement_montant_percu' in v_definition)=0
     or position('monnaie_rendue' in v_definition)=0 then
    raise exception 'Le ticket ne contrôle pas les montants de paiement conservés';
  end if;

  if to_regprocedure('public.reservation_lifecycle_cron()') is null then
    raise exception 'Orchestrateur du cycle de réservation absent';
  end if;
  if not has_function_privilege('service_role','public.reservation_lifecycle_cron()','EXECUTE') then
    raise exception 'Le service serveur ne peut pas exécuter le cycle';
  end if;
  if has_function_privilege('authenticated','public.reservation_lifecycle_cron()','EXECUTE')
     or has_function_privilege('anon','public.reservation_lifecycle_cron()','EXECUTE') then
    raise exception 'L’ordonnanceur est exposé aux utilisateurs applicatifs';
  end if;
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='reservation_lifecycle_cron';
  if position('expirer_reservations_cron' in v_definition)=0
     or position('notifier_reservations_expirant_30m' in v_definition)=0 then
    raise exception 'L’ordonnanceur ne traite pas les deux étapes métier';
  end if;

  if exists(select 1 from pg_catalog.pg_extension where extname='pg_cron')
     and to_regclass('cron.job') is not null then
    select count(*) into v_jobs from cron.job where jobname='naxa-reservation-lifecycle';
    if v_jobs <> 1 then raise exception 'Le job unifié doit être présent une seule fois (trouvé: %)', v_jobs; end if;
    if exists(select 1 from cron.job where jobname in (
      'naxa-reservation-expiry-release',
      'naxa-reservation-expire-stock-restore',
      'naxa-reservation-expiry-30m'
    )) then
      raise exception 'Un ancien job dupliqué de réservation est encore planifié';
    end if;
  end if;
end;
$test$;
rollback;
