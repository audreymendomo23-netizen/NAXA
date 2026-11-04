-- NAXA F07 — classify changed cached prices/totals as terminal conflicts, not generic failures.
begin;
do $patch$
declare
  v_definition text;
  v_old text := 'or v_error ilike ''%prix%''';
  v_new text := 'or v_error ilike ''%prix%'' or v_error ilike ''%price_changed%'' or v_error ilike ''%total_changed%''';
begin
  select pg_get_functiondef('public.naxa_apply_offline_sale_v1(uuid,uuid,jsonb,bigint)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition)=0 then
    raise exception 'F07 offline POS conflict classification patch could not find its expected source expression';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$patch$;
commit;
