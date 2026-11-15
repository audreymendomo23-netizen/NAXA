-- Verify that Caisse provisioning creates the physical resource atomically
-- through the canonical assignment guard and remains unavailable to anon.
do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.naxa_provision_caisse(uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('SECURITY DEFINER' in upper(v_definition)) = 0
     or position('AUTH.UID()' in upper(v_definition)) = 0
     or position('PUBLIC.NAXA_GRANT_PROFESSIONAL_ASSIGNMENT(' in upper(v_definition)) = 0
     or position('INSERT INTO PUBLIC.CAISSES' in upper(v_definition)) = 0
     or position('NAXA-CAISSE-RESOURCE:' in upper(v_definition)) = 0
     or position('CAISSE PRINCIPALE' in upper(v_definition)) = 0 then
    raise exception $msg$Le provisionnement Caisse doit valider l'affectation, sérialiser et créer le poste physique$msg$;
  end if;

  if has_function_privilege('anon','public.naxa_provision_caisse(uuid,uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_provision_caisse(uuid,uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('service_role','public.naxa_provision_caisse(uuid,uuid)'::regprocedure,'EXECUTE') then
    raise exception $msg$Les ACL de provisionnement Caisse doivent exclure anon et autoriser les rôles applicatifs attendus$msg$;
  end if;
end
$test$;

select 'Caisse resource provisioning is secured, serialized and linked to its professional assignment: PASS' as result;
