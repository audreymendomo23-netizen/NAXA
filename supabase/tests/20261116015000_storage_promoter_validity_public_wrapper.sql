-- Contrat de privilèges pour la politique Storage des justificatifs Pharmacien.
do $test$
declare
  v_check text;
begin
  select with_check into v_check
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and policyname='naxa_pharmacien_credential_insert_promoter';

  if v_check is null
     or position('public.naxa_promoteur_valide' in v_check)=0
     or position('private.naxa_promoteur_valide' in v_check)>0 then
    raise exception 'La politique Storage doit appeler le wrapper public contrôlé';
  end if;

  if not has_function_privilege('authenticated','public.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'authenticated doit pouvoir exécuter le wrapper public de validité Promoteur';
  end if;

  if has_function_privilege('authenticated','private.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'Le helper privé ne doit pas être exposé à authenticated';
  end if;
end
$test$;
