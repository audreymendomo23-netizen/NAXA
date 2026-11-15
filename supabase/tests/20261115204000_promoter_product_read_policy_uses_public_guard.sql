do $test$
declare
  v_policy record;
begin
  select policyname,cmd,roles,qual
    into v_policy
  from pg_policies
  where schemaname='public'
    and tablename='produits'
    and policyname='produits_authenticated_live_offer_read';

  if not found
     or v_policy.cmd<>'SELECT'
     or v_policy.roles<>'{authenticated}'
     or position('naxa_promoteur_valide' in lower(v_policy.qual))=0
     or position('private.naxa_promoteur_valide' in lower(v_policy.qual))>0 then
    raise exception 'La policy catalogue doit appeler le wrapper public auto-scopé, pas le helper privé';
  end if;

  if not has_function_privilege('authenticated','public.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'Le wrapper public auto-scopé doit être exécutable par authenticated';
  end if;

  if has_function_privilege('authenticated','private.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'Le helper privé de validation ne doit pas être exposé directement';
  end if;
end
$test$;

select 'Promoter authenticated catalogue SELECT uses self-scoped public helper; private helper remains hidden: PASS' as result;
