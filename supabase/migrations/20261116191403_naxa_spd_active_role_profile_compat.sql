do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_select_active_role(text,uuid,uuid)'::regprocedure) into v_definition;
 v_old := 'when p_role_code in (''admin'',''client'',''pharmacie'',''promoteur'') then null';
 v_new := 'when p_role_code in (''admin'',''client'',''pharmacie'',''promoteur'',''prestations'') then null';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Active role profile projection changed; abort patch'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;
end
$patch$;
