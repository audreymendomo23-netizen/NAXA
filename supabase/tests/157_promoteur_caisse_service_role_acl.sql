-- Test ACL sans fixtures ni modification de données métier.
do $test$
declare
  v_name text;
  v_sig text;
begin
  for v_name,v_sig in
    select * from (values
      ('naxa_provision_caisse','public.naxa_provision_caisse(uuid,uuid)'),
      ('naxa_set_caisse_status','public.naxa_set_caisse_status(uuid,boolean)'),
      ('naxa_grant_privilege','public.naxa_grant_privilege(uuid,text,uuid,text)'),
      ('naxa_revoke_privilege','public.naxa_revoke_privilege(uuid,text,uuid,text)')
    ) as x(nom,signature)
  loop
    if to_regprocedure(v_sig) is null then
      raise exception 'ACL157 : façade manquante %',v_name;
    end if;
    if has_function_privilege('anon',v_sig,'EXECUTE') then
      raise exception 'ACL157 : anon exécute %',v_name;
    end if;
    if not has_function_privilege('authenticated',v_sig,'EXECUTE') then
      raise exception 'ACL157 : authenticated ne peut pas exécuter %',v_name;
    end if;
    if has_function_privilege('service_role',v_sig,'EXECUTE') then
      raise exception 'ACL157 : service_role exécute encore %',v_name;
    end if;
  end loop;
  if to_regprocedure('private.naxa_grant_privilege(uuid,text,uuid,text)') is not null
     and has_function_privilege('service_role','private.naxa_grant_privilege(uuid,text,uuid,text)','EXECUTE') then
    raise exception 'ACL157 : service_role exécute le helper privé grant';
  end if;
  if to_regprocedure('private.naxa_revoke_privilege(uuid,text,uuid,text)') is not null
     and has_function_privilege('service_role','private.naxa_revoke_privilege(uuid,text,uuid,text)','EXECUTE') then
    raise exception 'ACL157 : service_role exécute le helper privé revoke';
  end if;
end
$test$;
select 'Test 157 Promoteur Caisse service_role ACL — PASS' as resultat;
