do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.synchroniser_validite_pharmacies()'::regprocedure)
 into v_definition;
 v_old := 'select distinct d.promoteur_id,true,''expired_unpaid'',now(),null';
 v_new := 'select distinct d.promoteur_id,true,''expired_unpaid'',now(),null::timestamptz';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Subscription lock NULL cast anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;
end
$patch$;
