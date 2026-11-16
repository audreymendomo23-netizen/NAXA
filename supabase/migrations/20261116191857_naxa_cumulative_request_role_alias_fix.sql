do $patch$
declare v_definition text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_definition:=replace(v_definition,'public.naxa_roles r','public.naxa_roles role_row');
 v_definition:=replace(v_definition,'where r.code=p_destination_role_code','where role_row.code=p_destination_role_code');
 v_definition:=replace(v_definition,'and r.actif=true and r.assignable=true and r.portee=''PHARMACIE''',
   'and role_row.actif=true and role_row.assignable=true and role_row.portee=''PHARMACIE''');
 if position('where r.code=p_destination_role_code' in v_definition)>0 then
   execute v_definition;
 end if;
end
$patch$;
