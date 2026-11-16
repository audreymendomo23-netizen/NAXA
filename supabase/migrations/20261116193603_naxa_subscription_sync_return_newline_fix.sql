do $patch$
declare v_definition text;
begin
 select pg_get_functiondef('public.synchroniser_validite_pharmacies()'::regprocedure)
 into v_definition;
 if position(E'\\\\n' in v_definition)>0 then
   v_definition:=replace(v_definition,E'\\\\n',chr(10));
   execute v_definition;
 end if;
end
$patch$;
