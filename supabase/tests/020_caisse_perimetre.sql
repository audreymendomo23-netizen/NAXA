-- NAXA 022 — test d'acceptation Caisse
-- Test structurel : aucun changement persistant.
begin;
select plan(20);

select ok(
 exists(select 1 from pg_proc where proname='naxa_has_privilege' and pronamespace='public'::regnamespace),
 'moteur de privilèges présent'
);

select ok(
 exists(select 1 from pg_proc where proname='naxa_provision_caisse' and pronamespace='public'::regnamespace),
 'provision Caisse canonique présente'
);

select ok(
 exists(select 1 from pg_proc where proname='stats_caisse_scope' and pronamespace='public'::regnamespace),
 'pilotage Caisse dédié présent'
);

select ok(
 exists(select 1 from pg_proc where proname='set_reservation_status' and pronamespace='public'::regnamespace),
 'transition réservation sécurisée présente'
);

select ok(
 exists(select 1 from pg_proc where proname='set_garde' and pronamespace='public'::regnamespace),
 'fonction garde sécurisée présente'
);

select ok(
 pg_get_functiondef('public.set_garde(boolean)'::regprocedure) like '%MANAGE_GUARD_STATUS%',
 'la garde exige le privilège dédié'
);

select ok(
 pg_get_functiondef('public.set_reservation_status(uuid,resa_statut)'::regprocedure) like '%CONFIRM_PAYMENT%',
 'le paiement exige un privilège'
);

select ok(
 pg_get_functiondef('public.set_reservation_status(uuid,resa_statut)'::regprocedure) like '%CONFIRM_WITHDRAWAL%',
 'le retrait exige un privilège'
);

select ok(
 pg_get_functiondef('public.set_reservation_status(uuid,resa_statut)'::regprocedure) like '%CANCEL_RESERVATION%',
 'l’annulation exige un privilège'
);

select ok(
 pg_get_functiondef('public.naxa_has_privilege(text,uuid,text)'::regprocedure) like '%naxa_architecture_privileges%',
 'l’architecture est une barrière effective'
);

select ok(
 not exists(
   select 1 from public.naxa_architecture_privileges
   where role_key='caisse'
     and privilege_code in ('IMPORT_STOCK','VIEW_PURCHASE_COST','EDIT_PURCHASE_COST','VIEW_MARGIN','MANAGE_GUARD_STATUS','MANAGE_CAISSES','CHANGE_ARCHITECTURE')
 ),
 'Caisse ne possède pas les privilèges de gestion supérieure'
);

select ok(
 exists(
   select 1 from public.naxa_architecture_privileges
   where role_key='caisse' and privilege_code='EDIT_STOCK_QUANTITY'
 ),
 'Caisse peut modifier les quantités'
);

select ok(
 exists(
   select 1 from public.naxa_architecture_privileges
   where role_key='caisse' and privilege_code='CONFIRM_PAYMENT'
 ),
 'Caisse peut confirmer un paiement'
);

select ok(
 exists(
   select 1 from public.naxa_architecture_privileges
   where role_key='caisse' and privilege_code='CONFIRM_WITHDRAWAL'
 ),
 'Caisse peut confirmer un retrait'
);

select ok(
 pg_get_functiondef('public.stats_caisse_scope(integer)'::regprocedure) like '%e.to_statut=''payee''%',
 'le CA Caisse est compté au paiement et non deux fois au retrait'
);

select ok(
 pg_get_functiondef('public.stats_caisse_scope(integer)'::regprocedure) like '%e.actor_id=uid%',
 'le pilotage Caisse est borné à l’acteur courant'
);

select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_caisse_update' and cmd='UPDATE'),
  'Caisse dispose uniquement d’une politique UPDATE dédiée'
);

select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_management_insert' and cmd='INSERT'),
  'INSERT stock est séparé et réservé au management'
);

select ok(
  not exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code in ('VIEW_REPORTS','VIEW_CAISSE_REPORT')),
  'aucun privilège Rapport Caisse non implémenté n’est présenté comme acquis'
);

select ok(
  not exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code in ('VIEW_CA','VIEW_CA_HISTORY')),
  'le CA global n’est pas exposé comme dataset Caisse'
);

select * from finish();
rollback;
