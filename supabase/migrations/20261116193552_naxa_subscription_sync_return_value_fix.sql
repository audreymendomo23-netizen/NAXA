do $patch$
declare v_definition text;
begin
 select pg_get_functiondef('public.synchroniser_validite_pharmacies()'::regprocedure)
 into v_definition;
 if position('return n;' in v_definition)=0 then
   v_definition:=replace(v_definition,
     '-- Scoped commercial locks must not disable the personal NAXA identity.',
     '-- Scoped commercial locks must not disable the personal NAXA identity.'||chr(10)||'  return n;');
   execute v_definition;
 end if;
end
$patch$;
