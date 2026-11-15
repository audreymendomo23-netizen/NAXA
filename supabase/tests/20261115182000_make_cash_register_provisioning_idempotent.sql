-- Static regression test: the exact active assignment conflict is the
-- only tolerated assignment result; all other grant errors still propagate.
do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.naxa_provision_caisse(uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('WHEN RAISE_EXCEPTION' in upper(v_definition)) = 0
     or position('SQLERRM <> ''UNE AFFECTATION ACTIVE DE CE RÔLE CHEVAUCHE DÉJÀ LA PÉRIODE''' in upper(v_definition)) = 0
     or position('A.STATUT = ''ACTIVE''' in upper(v_definition)) = 0
     or position('A.COMMENCE_AT <= NOW()' in upper(v_definition)) = 0
     or position('P.ACTIF = TRUE' in upper(v_definition)) = 0
     or position('PH.ACTIF = TRUE' in upper(v_definition)) = 0
     or position('INSERT INTO PUBLIC.CAISSES' in upper(v_definition)) = 0 then
    raise exception $msg$La réparation idempotente doit tolérer uniquement une affectation Caisse exacte, active et autorisée$msg$;
  end if;

  if has_function_privilege('anon','public.naxa_provision_caisse(uuid,uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_provision_caisse(uuid,uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('service_role','public.naxa_provision_caisse(uuid,uuid)'::regprocedure,'EXECUTE') then
    raise exception $msg$Les ACL de provisionnement Caisse doivent exclure anon$msg$;
  end if;
end
$test$;

select 'Caisse provisioning tolerates only the exact active assignment and repairs a missing resource: PASS' as result;
