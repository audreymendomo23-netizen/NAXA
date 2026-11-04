-- F07 / 283 — both offline domains share a strictly increasing device sequence.
begin;
do $test$
declare
  v_stock_definition text;
  v_sale_definition text;
begin
  select pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure)
    into v_stock_definition;
  select pg_get_functiondef('public.naxa_apply_offline_sale_v1(uuid,uuid,jsonb,bigint)'::regprocedure)
    into v_sale_definition;
  if position('public.naxa_offline_sales' in v_stock_definition)=0 then
    raise exception 'F07_283_FAIL: stock replay does not see POS sale sequences';
  end if;
  if position('public.offline_operations' in v_sale_definition)=0 then
    raise exception 'F07_283_FAIL: POS replay does not see stock operation sequences';
  end if;
  if position('public.naxa_offline_sales' in v_sale_definition)=0 then
    raise exception 'F07_283_FAIL: POS replay does not see prior POS sequences';
  end if;
  if position('device_sequence_not_monotonic' in v_stock_definition)=0
     or position('device_sequence_not_monotonic' in v_sale_definition)=0 then
    raise exception 'F07_283_FAIL: a replay path no longer rejects stale sequence numbers';
  end if;
  raise notice 'F07_283_PASS: stock and POS share the same device sequence domain';
end
$test$;
rollback;
