-- NAXA 022 — test d'acceptation Caisse
-- Exécutable sans pgTAP. Transactionnel : aucune donnée persistante.

begin;

do $$
declare n int := 0;
begin
  if not exists(select 1 from pg_proc where proname='naxa_has_privilege' and pronamespace='public'::regnamespace) then raise exception 'C01 moteur de privilèges absent'; end if; n:=n+1;
  if not exists(select 1 from pg_proc where proname='naxa_provision_caisse' and pronamespace='public'::regnamespace) then raise exception 'C02 provision absente'; end if; n:=n+1;
  if not exists(select 1 from pg_proc where proname='stats_caisse_scope' and pronamespace='public'::regnamespace) then raise exception 'C03 pilotage Caisse absent'; end if; n:=n+1;
  if not exists(select 1 from pg_proc where proname='set_reservation_status' and pronamespace='public'::regnamespace) then raise exception 'C04 transition absente'; end if; n:=n+1;
  if not exists(select 1 from pg_proc where proname='set_garde' and pronamespace='public'::regnamespace) then raise exception 'C05 garde absente'; end if; n:=n+1;
  if pg_get_functiondef('public.set_garde(boolean)'::regprocedure) not like '%MANAGE_GUARD_STATUS%' then raise exception 'C06 garde non protégée'; end if; n:=n+1;
  if pg_get_functiondef('public.set_reservation_status(uuid,resa_statut)'::regprocedure) not like '%CONFIRM_PAYMENT%' then raise exception 'C07 paiement non protégé'; end if; n:=n+1;
  if pg_get_functiondef('public.set_reservation_status(uuid,resa_statut)'::regprocedure) not like '%CONFIRM_WITHDRAWAL%' then raise exception 'C08 retrait non protégé'; end if; n:=n+1;
  if pg_get_functiondef('public.set_reservation_status(uuid,resa_statut)'::regprocedure) not like '%CANCEL_RESERVATION%' then raise exception 'C09 annulation non protégée'; end if; n:=n+1;
  if pg_get_functiondef('public.naxa_has_privilege(text,uuid,text)'::regprocedure) not like '%naxa_architecture_privileges%' then raise exception 'C10 architecture non effective'; end if; n:=n+1;
  if exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code in ('IMPORT_STOCK','VIEW_PURCHASE_COST','EDIT_PURCHASE_COST','VIEW_MARGIN','MANAGE_GUARD_STATUS','MANAGE_CAISSES','CHANGE_ARCHITECTURE')) then raise exception 'C11 privilèges supérieurs exposés'; end if; n:=n+1;
  if not exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code='EDIT_STOCK_QUANTITY') then raise exception 'C12 modification quantité absente'; end if; n:=n+1;
  if not exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code='CONFIRM_PAYMENT') then raise exception 'C13 paiement absent'; end if; n:=n+1;
  if not exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code='CONFIRM_WITHDRAWAL') then raise exception 'C14 retrait absent'; end if; n:=n+1;
  if pg_get_functiondef('public.stats_caisse_scope(integer)'::regprocedure) not like '%e.to_statut=''payee''%' then raise exception 'C15 double comptage CA possible'; end if; n:=n+1;
  if pg_get_functiondef('public.stats_caisse_scope(integer)'::regprocedure) not like '%e.actor_id=uid%' then raise exception 'C16 pilotage non borné à la Caisse'; end if; n:=n+1;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_caisse_update' and cmd='UPDATE') then raise exception 'C17 policy UPDATE Caisse absente'; end if; n:=n+1;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_management_insert' and cmd='INSERT') then raise exception 'C18 INSERT stock non séparé'; end if; n:=n+1;
  if exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code in ('VIEW_REPORTS','VIEW_CAISSE_REPORT')) then raise exception 'C19 rapports non construits mais exposés'; end if; n:=n+1;
  if exists(select 1 from public.naxa_architecture_privileges where role_key='caisse' and privilege_code in ('VIEW_CA','VIEW_CA_HISTORY')) then raise exception 'C20 CA global exposé'; end if; n:=n+1;
  raise notice 'NAXA CAISSE — %/20 assertions PASS', n;
end $$;

rollback;
