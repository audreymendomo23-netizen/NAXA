-- NAXA 239 — contrôles structurels du ticket client et de l'ordonnanceur unifié.
-- À exécuter uniquement après la migration correspondante, sur une base de test.
begin;
do $test$
declare
  v_definition text;
  v_jobs integer;
begin
  if to_regprocedure('public.naxa_reservation_receipt_snapshot()') is null
     or not exists (
       select 1 from pg_trigger
       where tgname='trg_naxa_reservation_receipt_snapshot'
         and tgrelid='public.reservations'::regclass
         and not tgisinternal
     ) then
    raise exception 'Le snapshot de reçu au passage à payée est absent';
  end if;
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

  if to_regprocedure('public.restore_stock(uuid)') is null then
    raise exception 'Fonction de restitution du stock absente';
  end if;
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='restore_stock';
  if position('reservation_item_lots' in v_definition)=0
     or position('stocks_lots' in v_definition)=0
     or position('stock_restored' in v_definition)=0
     or position('consumed_at' in v_definition)=0 then
    raise exception 'La restitution ne protège pas les lots, l’idempotence ou les ventes consommées';
  end if;
  if has_function_privilege('authenticated','public.restore_stock(uuid)','EXECUTE')
     or has_function_privilege('anon','public.restore_stock(uuid)','EXECUTE') then
    raise exception 'La restitution interne est exposée aux rôles applicatifs';
  end if;

  if to_regprocedure('public.expirer_reservations_cron(integer)') is null then
    raise exception 'Fonction serveur d’expiration absente';
  end if;
  if to_regprocedure('public.notifier_reservations_expirant_30m()') is null then
    raise exception 'Fonction serveur de notification absente';
  end if;
  if not has_function_privilege('service_role','public.expirer_reservations_cron(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.expirer_reservations_cron(integer)','EXECUTE')
     or has_function_privilege('anon','public.expirer_reservations_cron(integer)','EXECUTE') then
    raise exception 'Les droits d’expiration ne sont pas réservés au service serveur';
  end if;
  if not has_function_privilege('service_role','public.notifier_reservations_expirant_30m()','EXECUTE')
     or has_function_privilege('authenticated','public.notifier_reservations_expirant_30m()','EXECUTE')
     or has_function_privilege('anon','public.notifier_reservations_expirant_30m()','EXECUTE') then
    raise exception 'Les droits de notification ne sont pas réservés au service serveur';
  end if;
  if to_regclass('public.reservation_item_lots') is null
     or to_regclass('public.notifications_reservation_expiry_once_uq') is null then
    raise exception 'Les dépendances de restitution ou de notification unique sont absentes';
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
  if position('failedReservations' in v_definition)=0
     or position('en_echec' in v_definition)=0 then
    raise exception 'L’ordonnanceur peut déclarer vert un lot contenant des restitutions échouées';
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

-- Test comportemental isolé : le propriétaire récupère le ticket POS, un autre client est refusé.
do $ticket_behavior$
declare
  v_client uuid := gen_random_uuid();
  v_other_client uuid := gen_random_uuid();
  v_pharmacie uuid;
  v_produit uuid;
  v_session uuid := gen_random_uuid();
  v_reservation uuid := gen_random_uuid();
  v_vente uuid := gen_random_uuid();
  v_numero text;
  v_ticket jsonb;
  v_rejected boolean := false;
begin
  select s.pharmacie_id, s.produit_id
    into v_pharmacie, v_produit
  from public.stocks s
  limit 1;
  if v_pharmacie is null or v_produit is null then
    raise exception 'Fixture produit/pharmacie absente pour le test du ticket';
  end if;

  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values
    (v_client,'authenticated','authenticated','naxa239_ticket_'||substr(replace(v_client::text,'-',''),1,12)||'@invalid.local','',now(),now()),
    (v_other_client,'authenticated','authenticated','naxa239_other_'||substr(replace(v_other_client::text,'-',''),1,12)||'@invalid.local','',now(),now());

  insert into public.reservations(
    id,client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,paiement_mode
  ) values (
    v_reservation,v_client,v_pharmacie,'confirmee',100,now()+interval '1 hour','reservation','a_verifier','especes_retrait'
  );

  insert into public.ventes(
    id,pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,
    mode_paiement,paiement_ref,created_by,paid_at,reservation_id
  ) values (
    v_vente,v_pharmacie,v_session,v_client,'payee',0,100,100,'especes','NAXA239-TEST',v_client,now(),v_reservation
  ) returning numero_vente into v_numero;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  values(v_vente,v_produit,1,100);
  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue)
  values(v_vente,'especes',100,'NAXA239-TEST',v_client,150,50);
  set local session_replication_role = origin;

  update public.reservations
  set statut='payee', paiement_statut='effectue'
  where id=v_reservation;

  if not exists (
    select 1 from public.reservations
    where id=v_reservation
      and paiement_ticket_numero=v_numero
      and paiement_montant_percu=150
      and paiement_monnaie_rendue=50
      and paiement_valide_at is not null
  ) then
    raise exception 'Le trigger de paiement n’a pas figé le ticket POS dans la réservation';
  end if;

  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  v_ticket := public.get_client_reservation_ticket(v_reservation);
  if v_ticket->>'receipt_type' <> 'cashier_ticket'
     or v_ticket#>>'{sale,numero_vente}' is distinct from v_numero
     or (v_ticket#>>'{sale,total_net}')::integer <> 100
     or jsonb_array_length(v_ticket->'items') <> 1
     or jsonb_array_length(v_ticket->'payments') <> 1
     or (v_ticket#>>'{payments,0,montant_percu}')::integer <> 150
     or (v_ticket#>>'{payments,0,monnaie_rendue}')::integer <> 50 then
    raise exception 'Le ticket client ne correspond pas aux enregistrements POS';
  end if;

  perform set_config('request.jwt.claim.sub',v_other_client::text,true);
  v_rejected := false;
  begin
    perform public.get_client_reservation_ticket(v_reservation);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un autre client a pu lire le ticket de cette réservation';
  end if;
end;
$ticket_behavior$;


-- Test intégré : expiration/restauration idempotente + notification unique au travers de l’ordonnanceur.
do $lifecycle_behavior$
declare
  v_user uuid := gen_random_uuid();
  v_res_expired uuid;
  v_res_notice uuid;
  v_pharmacie uuid;
  v_produit uuid;
  v_prix integer;
  v_stock_before integer;
  v_stock_after integer;
  v_lifecycle jsonb;
  v_notices integer;
begin
  select s.pharmacie_id, s.produit_id, s.prix, s.quantite
    into v_pharmacie, v_produit, v_prix, v_stock_before
  from public.stocks s
  limit 1;
  if v_pharmacie is null or v_produit is null then
    raise exception 'Fixture stock/pharmacie absente pour le cycle de réservation';
  end if;

  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_user,'authenticated','authenticated',
    'naxa239_cycle_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now());

  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,stock_decremented,stock_restored
  ) values
    (v_user,v_pharmacie,'confirmee',v_prix,now()-interval '1 minute','reservation','a_verifier','especes_retrait',false,false)
  returning id into v_res_expired;

  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,stock_decremented,stock_restored
  ) values (
    v_user,v_pharmacie,'confirmee',v_prix,now()+interval '27 minutes','reservation','a_verifier','especes_retrait',false,false
  ) returning id into v_res_notice;

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_res_expired,v_produit,1,v_prix),(v_res_notice,v_produit,1,v_prix);
  set local session_replication_role = origin;

  v_lifecycle := public.reservation_lifecycle_cron();
  if coalesce((v_lifecycle->>'ok')::boolean,false) is not true then
    raise exception 'Une étape de l’ordonnanceur a échoué : %',v_lifecycle;
  end if;
  if not exists(select 1 from public.reservations where id=v_res_expired and statut='expiree') then
    raise exception 'La réservation échue n’a pas été expirée';
  end if;
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after is distinct from v_stock_before then
    raise exception 'Un hold moderne a modifié le stock physique à l’expiration';
  end if;

  v_lifecycle := public.reservation_lifecycle_cron();
  if coalesce((v_lifecycle->>'ok')::boolean,false) is not true then
    raise exception 'Le second passage de l’ordonnanceur a échoué : %',v_lifecycle;
  end if;
  select count(*) into v_notices from public.notifications
  where reservation_id=v_res_notice and type='reservation_expiry_30m';
  if v_notices <> 1 then
    raise exception 'Le rappel à 30 minutes a été créé % fois au lieu d’une',v_notices;
  end if;
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after is distinct from v_stock_before then
    raise exception 'Le second passage a modifié le stock physique';
  end if;
end;
$lifecycle_behavior$;


-- Contradiction : une réservation legacy sans allocation de lots doit rendre le cycle non vert.
do $lifecycle_failure_behavior$
declare
  v_user uuid := gen_random_uuid();
  v_reservation uuid;
  v_pharmacie uuid;
  v_produit uuid;
  v_lot uuid := gen_random_uuid();
  v_prix integer;
  v_stock_before integer;
  v_stock_after integer;
  v_lifecycle jsonb;
begin
  select s.pharmacie_id,s.produit_id,s.prix,s.quantite
    into v_pharmacie,v_produit,v_prix,v_stock_before
  from public.stocks s
  limit 1;
  if v_pharmacie is null or v_produit is null then
    raise exception 'Fixture de stock nécessaire au test d’échec indisponible';
  end if;

  insert into public.stocks_lots(
    id,pharmacie_id,produit_id,lot,numero_lot,peremption,date_peremption,quantite
  ) values (
    v_lot,v_pharmacie,v_produit,'NAXA239-'||left(replace(v_lot::text,'-',''),16),
    'NAXA239-'||left(replace(v_lot::text,'-',''),16),
    current_date+interval '365 days',current_date+interval '365 days',5
  );

  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_user,'authenticated','authenticated',
    'naxa239_fail_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now());
  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    paiement_mode,stock_decremented,stock_restored
  ) values (
    v_user,v_pharmacie,'confirmee',v_prix,now()-interval '1 minute',
    'reservation','a_verifier','especes_retrait',true,false
  ) returning id into v_reservation;
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_reservation,v_produit,1,v_prix);
  set local session_replication_role = origin;

  v_lifecycle := public.reservation_lifecycle_cron();
  if coalesce((v_lifecycle->>'ok')::boolean,true) is not false then
    raise exception 'Le cycle a déclaré ok=true malgré une restitution legacy non réconciliée : %',v_lifecycle;
  end if;
  if not exists (
    select 1 from public.reservations
    where id=v_reservation and statut='confirmee'
  ) then
    raise exception 'Une réservation incohérente a été expirée malgré l’échec de restitution';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_lifecycle->'errors','[]'::jsonb)) e
    where e->>'step'='expiration_stock_restore'
      and coalesce((e->>'failedReservations')::integer,0)>0
  ) then
    raise exception 'Le cycle ne remonte pas le nombre de restitutions échouées';
  end if;
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after is distinct from v_stock_before then
    raise exception 'Le stock a été modifié malgré une allocation de lots non réconciliée';
  end if;
end;
$lifecycle_failure_behavior$;

rollback;
