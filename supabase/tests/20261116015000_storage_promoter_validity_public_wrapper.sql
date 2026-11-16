-- Contrat de privilèges pour la politique Storage des justificatifs Pharmacien.
do $test$
declare
  v_public_wrapper boolean;
  v_private_helper boolean;
begin
  select exists (
    select 1
    from pg_policy p
    join pg_depend d
      on d.classid='pg_policy'::regclass
     and d.objid=p.oid
     and d.refclassid='pg_proc'::regclass
    join pg_proc pr on pr.oid=d.refobjid
    join pg_namespace n on n.oid=pr.pronamespace
    where p.polname='naxa_pharmacien_credential_insert_promoter'
      and n.nspname='public'
      and pr.proname='naxa_promoteur_valide'
      and pg_get_function_identity_arguments(pr.oid)='p_promoteur uuid'
  ) into v_public_wrapper;

  select exists (
    select 1
    from pg_policy p
    join pg_depend d
      on d.classid='pg_policy'::regclass
     and d.objid=p.oid
     and d.refclassid='pg_proc'::regclass
    join pg_proc pr on pr.oid=d.refobjid
    join pg_namespace n on n.oid=pr.pronamespace
    where p.polname='naxa_pharmacien_credential_insert_promoter'
      and n.nspname='private'
      and pr.proname='naxa_promoteur_valide'
  ) into v_private_helper;

  if not v_public_wrapper or v_private_helper then
    raise exception 'La politique Storage doit dépendre du wrapper public contrôlé';
  end if;

  if not has_function_privilege('authenticated','public.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'authenticated doit pouvoir exécuter le wrapper public de validité Promoteur';
  end if;

  if has_function_privilege('authenticated','private.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'Le helper privé ne doit pas être exposé à authenticated';
  end if;
end
$test$;
