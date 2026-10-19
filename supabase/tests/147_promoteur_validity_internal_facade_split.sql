-- NAXA 147 — la façade reste protégée, le helper privé sert aux contrôles internes.
do $test$
declare
  v_private text:=lower(pg_get_functiondef('private.naxa_promoteur_valide(uuid)'::regprocedure));
  v_public text:=lower(pg_get_functiondef('public.naxa_promoteur_valide(uuid)'::regprocedure));
  v_provision text:=lower(pg_get_functiondef('public.naxa_provision_promoteur_pharmacie(uuid,uuid)'::regprocedure));
begin
 if position('join public.conventions_promoteurs' in v_private)=0
    or position('join public.abonnements_promoteurs' in v_private)=0 then
   raise exception '147.1 : le helper interne doit vérifier convention et abonnement';
 end if;
 if position('auth.uid() is null' in v_private)>0
    or position('p_promoteur is distinct from auth.uid()' in v_private)>0 then
   raise exception '147.2 : le helper interne ne doit pas appliquer la restriction de la façade';
 end if;
 if position('p_promoteur is distinct from auth.uid()' in v_public)=0
    or position('public.is_admin()' in v_public)=0 then
   raise exception '147.3 : la façade publique doit rester limitée à soi-même ou admin';
 end if;
 if position('private.naxa_promoteur_valide(p_promoteur)' in v_provision)=0 then
   raise exception '147.4 : le provisioning interne doit utiliser le helper interne';
 end if;
 if has_function_privilege('authenticated','private.naxa_promoteur_valide(uuid)','EXECUTE')
    or has_function_privilege('anon','private.naxa_promoteur_valide(uuid)','EXECUTE') then
   raise exception '147.5 : helper interne exposé aux rôles API';
 end if;
end
$test$;
select 'Vérification 147 — validité interne/public séparée : PASS' as resultat;
