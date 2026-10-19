-- NAXA 146 — provisionnement soumis à la validité commerciale canonique.
do $test$
declare d text:=lower(pg_get_functiondef('public.naxa_provision_promoteur_pharmacie(uuid,uuid)'::regprocedure));
begin
 if position('public.naxa_promoteur_valide(p_promoteur)' in d)=0 then
   raise exception '146.1 : provisionnement sans contrôle de validité';
 end if;
 if position('promoteur commercialement invalide' in d)=0 then
   raise exception '146.2 : message explicite de refus absent';
 end if;
 if position('n.governance_only is not true' in d)=0 then
   raise exception '146.3 : privilèges de gouvernance legacy exclus';
 end if;
 if has_function_privilege('authenticated','public.naxa_provision_promoteur_pharmacie(uuid,uuid)','EXECUTE') then
   raise exception '146.4 : RPC de provisionnement réseau exposée à authenticated';
 end if;
end
$test$;
select 'Vérification 146 — provisionnement Promoteur : PASS' as resultat;
