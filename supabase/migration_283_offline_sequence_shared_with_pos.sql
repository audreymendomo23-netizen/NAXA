-- NAXA F07 — share one monotonic device sequence across stock corrections and POS sales.
begin;
do $patch$
declare
  v_definition text;
  v_old text := $old$  select coalesce(max(device_sequence),0) into v_last_device_sequence
  from public.offline_operations
  where device_id=p_device_id and operation_id<>p_operation_id;$old$;
  v_new text := $new$  select greatest(
    coalesce((select max(device_sequence) from public.offline_operations
      where device_id=p_device_id and operation_id<>p_operation_id),0),
    coalesce((select max(device_sequence) from public.naxa_offline_sales
      where device_id=p_device_id),0)
  ) into v_last_device_sequence;$new$;
begin
  select pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition)=0 then
    raise exception 'F07 sequence patch could not find the expected stock replay sequence check';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$patch$;
commit;
