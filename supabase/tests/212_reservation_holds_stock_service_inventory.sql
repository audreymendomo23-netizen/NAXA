-- Tests structurels et transactionnels de la règle stock-réservation-service.
-- Exécuter après migration_212_reservation_holds_stock_service_inventory.sql.
begin;

do $test$
declare
  v_reserve text;
  v_restore text;
  v_marketplace text;
begin
  if to_regprocedure('public.reserve_stock(uuid,jsonb)') is null
     or to_regprocedure('public.restore_stock(uuid)') is null
     or to_regprocedure('public.marketplace_offre_stock_disponible(uuid,uuid)') is null then
    raise exception 'Les RPC stock/réservation requises sont absentes';
  end if;

  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure) into v_reserve;
  select pg_get_functiondef('public.restore_stock(uuid)'::regprocedure) into v_restore;
  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure) into v_marketplace;

  if position('stock_decremented' in v_reserve)=0
     or position('update public.stocks set quantite=quantite-v_q' in lower(v_reserve))>0 then
    raise exception 'La création de réservation débite encore le stock physique';
  end if;
  if position('stock_decremented' in v_restore)=0
     or position('stock_restored' in v_restore)=0
     or position('consumed_at' in v_restore)=0 then
    raise exception 'La restauration legacy n’est pas protégée contre le double réajout';
  end if;
  if position('reservation_items' in v_marketplace)=0
     or position('stock_decremented' in v_marketplace)=0
     or position('stock_restored' in v_marketplace)=0 then
    raise exception 'Le Marketplace ne soustrait pas les holds actifs au stock physique';
  end if;

  if to_regclass('public.stock_service_sessions') is null
     or to_regclass('public.stock_service_inventory_counts') is null then
    raise exception 'Les tables d’inventaire par service sont absentes';
  end if;
  if to_regprocedure('public.stock_service_open(uuid,text)') is null
     or to_regprocedure('public.stock_service_record_count(uuid,text,jsonb)') is null
     or to_regprocedure('public.stock_service_close(uuid,text)') is null then
    raise exception 'Les RPC de prise/fin de service sont absentes';
  end if;

  if has_function_privilege('authenticated','public.consume_reservation_for_sale(uuid,uuid)','EXECUTE') then
    raise exception 'La consommation de réservation est exposée directement au client';
  end if;
end;
$test$;

rollback;
