-- NAXA 139 — contrôle du défaut de compatibilité abonnements.
do $test$
begin
 if (select column_default from information_schema.columns where table_schema='public' and table_name='abonnements' and column_name='formule') not like '%essentiel%' then
   raise exception '139.1 : formule doit avoir le défaut essentiel';
 end if;
end
$test$;
select 'Vérification 139 — défaut abonnement legacy : PASS' as resultat;
