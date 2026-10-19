-- NAXA 137 — régression du schéma contrat/architecture Promoteur.
do $test$
begin
 if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='conventions_promoteurs' and column_name='architecture_code') then
   raise exception '137.1 : architecture_code absent de la convention';
 end if;
 if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='naxa_privileges' and column_name='governance_only') then
   raise exception '137.2 : compatibilité governance_only absente';
 end if;
 if (select count(*) from public.naxa_architectures where active and code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')) <> 4 then
   raise exception '137.3 : catalogue des quatre architectures incomplet';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.naxa_architectures'::regclass) then
   raise exception '137.4 : RLS du catalogue architecture désactivée';
 end if;
 if has_table_privilege('anon','public.naxa_architectures','SELECT') then
   raise exception '137.5 : anon ne doit pas lire le catalogue architecture';
 end if;
end
$test$;
select 'Vérification 137 — schéma Promoteur/architecture : PASS' as resultat;
