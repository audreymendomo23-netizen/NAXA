-- Test statique ciblé de la réconciliation du helper de validité Promoteur.
-- À exécuter uniquement dans un environnement de test non-Production.
do $test$
declare
  v_private text:=lower(pg_get_functiondef('private.naxa_promoteur_valide(uuid)'::regprocedure));
  v_public text:=lower(pg_get_functiondef('public.naxa_promoteur_valide(uuid)'::regprocedure));
begin
  if position('c.architecture_code is not null' in v_private)=0 then
    raise exception 'PVH.1 : architecture de convention obligatoire absente';
  end if;
  if position('from public.promoteur_pharmacies pp' in v_private)=0
     or position('pp.actif=true' in v_private)=0 then
    raise exception 'PVH.2 : réseau actif obligatoire absent';
  end if;
  if position('not exists' in v_private)=0
     or position('pa.architecture_code=c.architecture_code' in v_private)=0
     or position('ph.actif is not true' in v_private)=0 then
    raise exception 'PVH.3 : cohérence pharmacie/architecture absente';
  end if;
  if position('p_promoteur is distinct from auth.uid()' in v_public)=0
     or position('public.is_admin()' in v_public)=0 then
    raise exception 'PVH.4 : façade publique sans garde identité/Admin';
  end if;
  if has_function_privilege('anon','private.naxa_promoteur_valide(uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.naxa_promoteur_valide(uuid)','EXECUTE')
     or has_function_privilege('service_role','private.naxa_promoteur_valide(uuid)','EXECUTE') then
    raise exception 'PVH.5 : helper privé exposé à un rôle API';
  end if;
end
$test$;
select 'Réconciliation helper validité Promoteur — PASS' as resultat;
